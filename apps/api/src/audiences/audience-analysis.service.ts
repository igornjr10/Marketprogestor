import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CacheService } from '../cache/cache.service'
import type { BreakdownResult, BreakdownRow, HeatmapResult, HeatmapCell } from '@marketproads/types'

const round2 = (n: number) => Math.round(n * 100) / 100

type StoredBreakdown = {
  age?: RawBreakdownRow[]
  gender?: RawBreakdownRow[]
  device?: RawBreakdownRow[]
  platform?: RawBreakdownRow[]
}

type RawBreakdownRow = {
  label: string
  spend: number
  impressions: number
  clicks: number
  reach: number
}

const DIMENSION_MAP: Record<string, keyof StoredBreakdown> = {
  age: 'age',
  gender: 'gender',
  device_platform: 'device',
  publisher_platform: 'platform',
}

@Injectable()
export class AudienceAnalysisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async getBreakdown(tenantId: string, clientId: string, dimension: string, period: number): Promise<BreakdownResult> {
    const dimKey = DIMENSION_MAP[dimension] ?? dimension as keyof StoredBreakdown
    const key = `audiences:v1:breakdown:${clientId}:${period}:${dimension}`
    return this.cache.withCache(key, 3600, async () => {
      await this.assertClientAccess(tenantId, clientId)
      const rows = await this.fetchBreakdownRows(clientId, period, dimKey)

      const totals = {
        spend: rows.reduce((s, r) => s + r.spend, 0),
        impressions: rows.reduce((s, r) => s + r.impressions, 0),
        clicks: rows.reduce((s, r) => s + r.clicks, 0),
        reach: rows.reduce((s, r) => s + r.reach, 0),
      }

      const breakdownRows: BreakdownRow[] = rows.map((r) => ({
        label: r.label,
        spend: round2(r.spend),
        impressions: r.impressions,
        clicks: r.clicks,
        reach: r.reach,
        ctr: r.impressions > 0 ? round2((r.clicks / r.impressions) * 100) : 0,
        cpm: r.impressions > 0 ? round2((r.spend / r.impressions) * 1000) : 0,
        pct: totals.spend > 0 ? round2((r.spend / totals.spend) * 100) : 0,
      })).sort((a, b) => b.spend - a.spend)

      return {
        dimension,
        rows: breakdownRows,
        totals: {
          spend: round2(totals.spend),
          impressions: totals.impressions,
          clicks: totals.clicks,
          reach: totals.reach,
        },
      }
    })
  }

  async getHeatmap(tenantId: string, clientId: string, dim1: string, dim2: string, period: number): Promise<HeatmapResult> {
    const key = `audiences:v1:heatmap:${clientId}:${period}:${dim1}:${dim2}`
    return this.cache.withCache(key, 3600, async () => {
      await this.assertClientAccess(tenantId, clientId)
      const key1 = DIMENSION_MAP[dim1] ?? dim1 as keyof StoredBreakdown
      const key2 = DIMENSION_MAP[dim2] ?? dim2 as keyof StoredBreakdown

      const [rows1, rows2] = await Promise.all([
        this.fetchBreakdownRows(clientId, period, key1),
        this.fetchBreakdownRows(clientId, period, key2),
      ])

      const totalSpend = rows1.reduce((s, r) => s + r.spend, 0)

      const dim1Values = rows1.map((r) => r.label)
      const dim2Values = rows2.map((r) => r.label)

      // Estimate cross-spend proportionally: cell(d1,d2) ≈ pct_d1 * pct_d2 * total
      const cells: HeatmapCell[] = []
      for (const r1 of rows1) {
        for (const r2 of rows2) {
          const pct1 = totalSpend > 0 ? r1.spend / totalSpend : 0
          const pct2 = totalSpend > 0 ? r2.spend / totalSpend : 0
          const estimatedSpend = totalSpend * pct1 * pct2
          const pct = totalSpend > 0 ? round2((estimatedSpend / totalSpend) * 100) : 0
          cells.push({ dim1: r1.label, dim2: r2.label, spend: round2(estimatedSpend), pct })
        }
      }

      return { dim1Values, dim2Values, cells }
    })
  }

  private async fetchBreakdownRows(clientId: string, period: number, dimKey: keyof StoredBreakdown): Promise<RawBreakdownRow[]> {
    const since = new Date()
    since.setDate(since.getDate() - period)

    const campaignIds = await this.getCampaignIds(clientId)
    if (campaignIds.length === 0) return []

    const insights = await this.prisma.client.insight.findMany({
      where: {
        entityType: 'CAMPAIGN',
        entityId: { in: campaignIds },
        date: { gte: since },
        NOT: { breakdowns: { equals: 'DbNull' } },
      },
      select: { breakdowns: true },
    })

    const aggregated = new Map<string, RawBreakdownRow>()

    for (const insight of insights) {
      const bd = insight.breakdowns as StoredBreakdown | null
      if (!bd) continue
      const rows = bd[dimKey] ?? []
      for (const row of rows) {
        const existing = aggregated.get(row.label)
        if (existing) {
          existing.spend += row.spend
          existing.impressions += row.impressions
          existing.clicks += row.clicks
          existing.reach += row.reach
        } else {
          aggregated.set(row.label, { ...row })
        }
      }
    }

    return Array.from(aggregated.values())
  }

  private async getCampaignIds(clientId: string): Promise<string[]> {
    const campaigns = await this.prisma.client.campaign.findMany({
      where: { adAccount: { clientId } },
      select: { metaCampaignId: true },
    })
    return campaigns.map((c) => c.metaCampaignId)
  }

  private async assertClientAccess(tenantId: string, clientId: string) {
    const client = await this.prisma.client.client.findFirst({
      where: { id: clientId, tenantId, status: { not: 'DELETED' } },
    })
    if (!client) throw new NotFoundException('Client não encontrado')
  }
}
