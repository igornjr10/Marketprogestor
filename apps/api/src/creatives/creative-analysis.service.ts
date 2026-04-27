import { Injectable, NotFoundException, Logger } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CacheService } from '../cache/cache.service'
import type { CreativeCard, CreativeGalleryPage, CreativeTimeline, FatigueDetails, FatigueLevel } from '@marketproads/types'

type InsightRow = {
  entityId: string
  date: Date
  spend: number
  impressions: number
  reach: number
  clicks: number
  frequency: number | null
}

type CreativeOpts = {
  period: number
  sort: string
  fatigueFilter?: string
  page: number
  limit: number
}

type CreativeData = {
  thumbnail_url?: string
  image_url?: string
  video_id?: string
  body?: string
  title?: string
}

const round2 = (n: number) => Math.round(n * 100) / 100

@Injectable()
export class CreativeAnalysisService {
  private readonly logger = new Logger(CreativeAnalysisService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async getCreativesGallery(tenantId: string, clientId: string, opts: CreativeOpts): Promise<CreativeGalleryPage> {
    const { period, sort, fatigueFilter, page, limit } = opts
    const key = `creatives:v1:gallery:${clientId}:${period}:${sort}:${fatigueFilter ?? 'ALL'}:${page}`
    return this.cache.withCache(key, 900, async () => {
      await this.assertClientAccess(tenantId, clientId)

      const ads = await this.fetchAdsForClient(clientId)
      if (ads.length === 0) {
        return { creatives: [], pagination: { page, limit, total: 0, pages: 0 } }
      }

      const adIds = ads.map((a) => a.metaAdId)
      const since = this.sinceDate(period)
      const insights = await this.fetchAdInsights(adIds, since)
      const insightsByAd = this.groupBy(insights, (r) => r.entityId)

      let creatives: CreativeCard[] = ads.map((ad) => {
        const rows = insightsByAd.get(ad.metaAdId) ?? []
        const metrics = this.aggregateMetrics(rows)
        const fatigue = this.detectFatigue(rows)
        const cd = (ad.creativeData as CreativeData) ?? {}
        const campaign = ad.adSet.campaign
        return {
          id: ad.id,
          adId: ad.metaAdId,
          name: ad.name,
          status: ad.status,
          campaignId: campaign.id,
          campaignName: campaign.name,
          adSetId: ad.adSet.id,
          thumbnailUrl: cd.thumbnail_url ?? null,
          imageUrl: cd.image_url ?? null,
          videoId: cd.video_id ?? null,
          body: cd.body ?? null,
          title: cd.title ?? null,
          ...metrics,
          fatigue,
        }
      })

      if (fatigueFilter && fatigueFilter !== 'ALL') {
        creatives = creatives.filter((c) => c.fatigue.level === fatigueFilter)
      }

      creatives = this.sortCreatives(creatives, sort)

      const total = creatives.length
      const pages = Math.ceil(total / limit)
      const paginated = creatives.slice((page - 1) * limit, page * limit)

      return { creatives: paginated, pagination: { page, limit, total, pages } }
    })
  }

  async getCreativeMetrics(tenantId: string, clientId: string, adId: string, period: number): Promise<CreativeCard> {
    await this.assertClientAccess(tenantId, clientId)

    const ad = await this.prisma.client.ad.findFirst({
      where: { metaAdId: adId },
      include: { adSet: { include: { campaign: { include: { adAccount: { select: { clientId: true } } } } } } },
    })

    if (!ad || ad.adSet.campaign.adAccount.clientId !== clientId) {
      throw new NotFoundException('Criativo não encontrado')
    }

    const since = this.sinceDate(period)
    const insights = await this.fetchAdInsights([adId], since)
    const metrics = this.aggregateMetrics(insights)
    const fatigue = this.detectFatigue(insights)
    const cd = (ad.creativeData as CreativeData) ?? {}

    return {
      id: ad.id,
      adId: ad.metaAdId,
      name: ad.name,
      status: ad.status,
      campaignId: ad.adSet.campaign.id,
      campaignName: ad.adSet.campaign.name,
      adSetId: ad.adSet.id,
      thumbnailUrl: cd.thumbnail_url ?? null,
      imageUrl: cd.image_url ?? null,
      videoId: cd.video_id ?? null,
      body: cd.body ?? null,
      title: cd.title ?? null,
      ...metrics,
      fatigue,
    }
  }

  async getCreativeTimeline(tenantId: string, clientId: string, adId: string): Promise<CreativeTimeline[]> {
    await this.assertClientAccess(tenantId, clientId)

    const since = this.sinceDate(30)
    const insights = await this.fetchAdInsights([adId], since)

    return insights
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((r) => ({
        date: r.date.toISOString().slice(0, 10),
        spend: round2(r.spend),
        impressions: r.impressions,
        clicks: r.clicks,
        ctr: r.impressions > 0 ? round2((r.clicks / r.impressions) * 100) : 0,
        frequency: round2(r.frequency ?? 0),
      }))
  }

  detectFatigue(insights: InsightRow[]): FatigueDetails {
    const sorted = [...insights].sort((a, b) => a.date.getTime() - b.date.getTime())
    const ctr = (r: InsightRow) => (r.impressions > 0 ? r.clicks / r.impressions : 0)
    const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0)

    const baseline = sorted.slice(0, 7)
    const recent = sorted.slice(-3)

    const baselineCtr = avg(baseline.map(ctr))
    const currentCtr = recent.length >= 1 ? avg(recent.map(ctr)) : baselineCtr
    const frequency = avg(recent.map((r) => r.frequency ?? 0))
    const delta = baselineCtr > 0 ? (baselineCtr - currentCtr) / baselineCtr : 0

    let level: FatigueLevel = 'NONE'
    if (delta > 0.40 && frequency > 3.5) level = 'SEVERE'
    else if (delta > 0.25 && frequency > 2.5) level = 'MODERATE'

    return { level, baselineCtr: round2(baselineCtr * 100), currentCtr: round2(currentCtr * 100), delta: round2(delta), frequency: round2(frequency) }
  }

  private aggregateMetrics(rows: InsightRow[]) {
    const spend = rows.reduce((s, r) => s + r.spend, 0)
    const impressions = rows.reduce((s, r) => s + r.impressions, 0)
    const clicks = rows.reduce((s, r) => s + r.clicks, 0)
    const reach = rows.reduce((s, r) => s + r.reach, 0)
    const freqSum = rows.reduce((s, r) => s + (r.frequency ?? 0), 0)
    const ctr = impressions > 0 ? round2((clicks / impressions) * 100) : 0
    const cpm = impressions > 0 ? round2((spend / impressions) * 1000) : 0
    const cpc = clicks > 0 ? round2(spend / clicks) : 0
    const frequency = rows.length > 0 ? round2(freqSum / rows.length) : 0
    return { spend: round2(spend), impressions, clicks, reach, ctr, cpm, cpc, frequency }
  }

  private sortCreatives(creatives: CreativeCard[], sort: string): CreativeCard[] {
    const [field, dir] = sort.split(':')
    const direction = dir === 'asc' ? 1 : -1
    const fatigueOrder: Record<FatigueLevel, number> = { SEVERE: 0, MODERATE: 1, NONE: 2 }

    return [...creatives].sort((a, b) => {
      if (field === 'fatigue') return (fatigueOrder[a.fatigue.level] - fatigueOrder[b.fatigue.level]) * direction
      const aVal = (a as Record<string, unknown>)[field] as number ?? 0
      const bVal = (b as Record<string, unknown>)[field] as number ?? 0
      return (aVal - bVal) * direction
    })
  }

  private async fetchAdsForClient(clientId: string) {
    return this.prisma.client.ad.findMany({
      where: {
        adSet: {
          campaign: {
            adAccount: { clientId },
          },
        },
      },
      include: {
        adSet: {
          select: {
            id: true,
            campaign: { select: { id: true, name: true, adAccount: { select: { clientId: true } } } },
          },
        },
      },
    })
  }

  private async fetchAdInsights(adIds: string[], since: Date): Promise<InsightRow[]> {
    return this.prisma.client.insight.findMany({
      where: { entityType: 'AD', entityId: { in: adIds }, date: { gte: since } },
      select: { entityId: true, date: true, spend: true, impressions: true, reach: true, clicks: true, frequency: true },
    }) as Promise<InsightRow[]>
  }

  private sinceDate(periodDays: number): Date {
    const d = new Date()
    d.setDate(d.getDate() - periodDays)
    d.setHours(0, 0, 0, 0)
    return d
  }

  private groupBy<T>(arr: T[], key: (item: T) => string): Map<string, T[]> {
    const map = new Map<string, T[]>()
    for (const item of arr) {
      const k = key(item)
      const existing = map.get(k) ?? []
      existing.push(item)
      map.set(k, existing)
    }
    return map
  }

  private async assertClientAccess(tenantId: string, clientId: string) {
    const client = await this.prisma.client.client.findFirst({
      where: { id: clientId, tenantId, status: { not: 'DELETED' } },
    })
    if (!client) throw new NotFoundException('Client não encontrado')
  }
}
