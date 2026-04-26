import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CacheService } from '../cache/cache.service'
import type { OverviewKpis, OverviewResponse, TimeSeriesPoint, CampaignWithMetrics, CampaignMetricsPage } from '@marketproads/types'

type InsightRaw = {
  spend: number
  impressions: number
  reach: number
  clicks: number
  date: Date
}

type CampaignMetricsOpts = {
  period: number
  status?: string
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  page: number
  limit: number
}

const VALID_SORT_FIELDS = new Set(['spend', 'impressions', 'clicks', 'ctr', 'cpm', 'cpc', 'reach'])

@Injectable()
export class MetricsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async getOverview(tenantId: string, clientId: string, period: number, compare: boolean): Promise<OverviewResponse> {
    const key = `metrics:v1:overview:${clientId}:${period}:${compare}`
    const ttl = period <= 1 ? 900 : 3600

    return this.cache.withCache(key, ttl, async () => {
      await this.assertClientAccess(tenantId, clientId)
      const metaIds = await this.getCampaignMetaIds(clientId)

      if (metaIds.length === 0) {
        const zero = this.zeroKpis()
        return { current: zero, previous: compare ? zero : null, deltas: compare ? this.zeroDeltas() : null }
      }

      const { since, until } = this.periodDates(period)
      const currentRows = await this.queryInsights(metaIds, since, until)
      const current = this.aggregateKpis(currentRows)

      if (!compare) return { current, previous: null, deltas: null }

      const { since: prevSince, until: prevUntil } = this.periodDates(period, period)
      const previousRows = await this.queryInsights(metaIds, prevSince, prevUntil)
      const previous = this.aggregateKpis(previousRows)
      const deltas = this.calcDeltas(current, previous)

      return { current, previous, deltas }
    })
  }

  async getTimeSeries(
    tenantId: string,
    clientId: string,
    period: number,
    granularity: string,
    metrics: string[],
  ): Promise<TimeSeriesPoint[]> {
    const safeMetrics = metrics.filter((m) => VALID_SORT_FIELDS.has(m)).sort()
    const key = `metrics:v1:timeseries:${clientId}:${period}:${granularity}:${safeMetrics.join(',')}`
    const ttl = period <= 1 ? 900 : 3600

    return this.cache.withCache(key, ttl, async () => {
      await this.assertClientAccess(tenantId, clientId)
      const metaIds = await this.getCampaignMetaIds(clientId)

      if (metaIds.length === 0) return []

      const { since, until } = this.periodDates(period)
      const rows = await this.queryInsights(metaIds, since, until)

      const byDate = rows.reduce<Record<string, { spend: number; impressions: number; clicks: number; reach: number }>>(
        (acc, r) => {
          const date = r.date.toISOString().slice(0, 10)
          if (!acc[date]) acc[date] = { spend: 0, impressions: 0, clicks: 0, reach: 0 }
          acc[date].spend += r.spend
          acc[date].impressions += r.impressions
          acc[date].clicks += r.clicks
          acc[date].reach += r.reach
          return acc
        },
        {},
      )

      return Object.entries(byDate)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, m]) => ({
          date,
          spend: Math.round(m.spend * 100) / 100,
          impressions: m.impressions,
          clicks: m.clicks,
          reach: m.reach,
          ctr: m.impressions > 0 ? Math.round((m.clicks / m.impressions) * 10000) / 100 : 0,
          cpm: m.impressions > 0 ? Math.round((m.spend / m.impressions) * 100000) / 100 : 0,
          cpc: m.clicks > 0 ? Math.round((m.spend / m.clicks) * 100) / 100 : 0,
        }))
    })
  }

  async getCampaignMetricsPage(tenantId: string, clientId: string, opts: CampaignMetricsOpts): Promise<CampaignMetricsPage> {
    const { period, status, sortBy, sortDir = 'desc', page, limit } = opts
    const key = `metrics:v1:campaigns:${clientId}:${period}:${status ?? ''}:${sortBy ?? ''}:${sortDir}:${page}`
    const ttl = 900

    return this.cache.withCache(key, ttl, async () => {
      await this.assertClientAccess(tenantId, clientId)
      const adAccountIds = await this.getAdAccountIds(clientId)

      const where = {
        adAccountId: { in: adAccountIds },
        ...(status ? { status } : {}),
      }

      const campaigns = await this.prisma.client.campaign.findMany({ where })

      const metaIds = campaigns.map((c) => c.metaCampaignId)
      const metricsMap = await this.buildCampaignMetricsMap(metaIds, period)

      let enriched: CampaignWithMetrics[] = campaigns.map((c) => ({
        ...c,
        startTime: c.startTime.toISOString(),
        stopTime: c.stopTime?.toISOString() ?? null,
        createdTime: c.createdTime.toISOString(),
        updatedTime: c.updatedTime.toISOString(),
        lastSyncedAt: c.lastSyncedAt?.toISOString() ?? null,
        metrics: metricsMap.get(c.metaCampaignId) ?? this.zeroCampaignMetrics(),
      }))

      if (sortBy && VALID_SORT_FIELDS.has(sortBy)) {
        enriched.sort((a, b) => {
          const av = a.metrics[sortBy as keyof typeof a.metrics] ?? 0
          const bv = b.metrics[sortBy as keyof typeof b.metrics] ?? 0
          return sortDir === 'asc' ? av - bv : bv - av
        })
      }

      const total = enriched.length
      const paginated = enriched.slice((page - 1) * limit, page * limit)

      return {
        campaigns: paginated,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      }
    })
  }

  private async assertClientAccess(tenantId: string, clientId: string) {
    const client = await this.prisma.client.client.findFirst({
      where: { id: clientId, tenantId, status: { not: 'DELETED' } },
    })
    if (!client) throw new NotFoundException('Client não encontrado')
  }

  private async getAdAccountIds(clientId: string): Promise<string[]> {
    const accounts = await this.prisma.client.metaAdAccount.findMany({
      where: { clientId },
      select: { id: true },
    })
    return accounts.map((a) => a.id)
  }

  private async getCampaignMetaIds(clientId: string): Promise<string[]> {
    const adAccountIds = await this.getAdAccountIds(clientId)
    if (adAccountIds.length === 0) return []
    const campaigns = await this.prisma.client.campaign.findMany({
      where: { adAccountId: { in: adAccountIds } },
      select: { metaCampaignId: true },
    })
    return campaigns.map((c) => c.metaCampaignId)
  }

  private async queryInsights(metaIds: string[], since: Date, until: Date): Promise<InsightRaw[]> {
    return this.prisma.client.insight.findMany({
      where: { entityType: 'CAMPAIGN', entityId: { in: metaIds }, date: { gte: since, lte: until } },
      select: { spend: true, impressions: true, reach: true, clicks: true, date: true },
    })
  }

  private async buildCampaignMetricsMap(metaIds: string[], period: number): Promise<Map<string, ReturnType<MetricsService['zeroCampaignMetrics']>>> {
    const { since, until } = this.periodDates(period)
    const rows = await this.prisma.client.insight.findMany({
      where: { entityType: 'CAMPAIGN', entityId: { in: metaIds }, date: { gte: since, lte: until } },
      select: { entityId: true, spend: true, impressions: true, reach: true, clicks: true },
    })

    const map = new Map<string, { spend: number; impressions: number; reach: number; clicks: number }>()
    for (const r of rows) {
      const acc = map.get(r.entityId) ?? { spend: 0, impressions: 0, reach: 0, clicks: 0 }
      acc.spend += r.spend
      acc.impressions += r.impressions
      acc.reach += r.reach
      acc.clicks += r.clicks
      map.set(r.entityId, acc)
    }

    const result = new Map<string, ReturnType<MetricsService['zeroCampaignMetrics']>>()
    for (const [id, m] of map) {
      result.set(id, {
        spend: Math.round(m.spend * 100) / 100,
        impressions: m.impressions,
        clicks: m.clicks,
        reach: m.reach,
        ctr: m.impressions > 0 ? Math.round((m.clicks / m.impressions) * 10000) / 100 : 0,
        cpm: m.impressions > 0 ? Math.round((m.spend / m.impressions) * 100000) / 100 : 0,
        cpc: m.clicks > 0 ? Math.round((m.spend / m.clicks) * 100) / 100 : 0,
      })
    }
    return result
  }

  private periodDates(period: number, offsetDays = 0): { since: Date; until: Date } {
    const until = new Date()
    until.setDate(until.getDate() - offsetDays)
    until.setHours(23, 59, 59, 999)
    const since = new Date(until)
    since.setDate(since.getDate() - period)
    since.setHours(0, 0, 0, 0)
    return { since, until }
  }

  private aggregateKpis(rows: InsightRaw[]): OverviewKpis {
    const totals = rows.reduce(
      (acc, r) => ({
        spend: acc.spend + r.spend,
        impressions: acc.impressions + r.impressions,
        reach: acc.reach + r.reach,
        clicks: acc.clicks + r.clicks,
      }),
      { spend: 0, impressions: 0, reach: 0, clicks: 0 },
    )

    return {
      ...totals,
      spend: Math.round(totals.spend * 100) / 100,
      ctr: totals.impressions > 0 ? Math.round((totals.clicks / totals.impressions) * 10000) / 100 : 0,
      cpm: totals.impressions > 0 ? Math.round((totals.spend / totals.impressions) * 100000) / 100 : 0,
      cpc: totals.clicks > 0 ? Math.round((totals.spend / totals.clicks) * 100) / 100 : 0,
    }
  }

  private calcDeltas(current: OverviewKpis, previous: OverviewKpis): Record<string, number | null> {
    const keys = Object.keys(current) as Array<keyof OverviewKpis>
    return Object.fromEntries(
      keys.map((k) => {
        const prev = previous[k]
        if (prev === 0) return [k, null]
        return [k, Math.round(((current[k] - prev) / prev) * 10000) / 100]
      }),
    )
  }

  private zeroKpis(): OverviewKpis {
    return { spend: 0, impressions: 0, reach: 0, clicks: 0, ctr: 0, cpm: 0, cpc: 0 }
  }

  private zeroDeltas(): Record<string, number | null> {
    return { spend: null, impressions: null, reach: null, clicks: null, ctr: null, cpm: null, cpc: null }
  }

  private zeroCampaignMetrics() {
    return { spend: 0, impressions: 0, clicks: 0, reach: 0, ctr: 0, cpm: 0, cpc: 0 }
  }
}
