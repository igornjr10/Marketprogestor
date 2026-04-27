import { Injectable, Logger } from '@nestjs/common'
import { Worker, Job, Queue } from 'bullmq'
import Redis from 'ioredis'
import { randomUUID } from 'crypto'
import { PrismaService } from './prisma.service'
import { decrypt } from '@marketproads/crypto'
import { Prisma } from '@marketproads/database'
import { RateLimitHandler } from './rate-limit.handler'
import { MetaApiAdapter } from '../integrations/meta-api.adapter'
import type { MetaCampaign, MetaAdSet, MetaAd, MetaInsightRow, MetaBreakdownRow } from '../integrations/meta-api.types'

const toJson = (v: unknown): Prisma.InputJsonValue => v as Prisma.InputJsonValue

export const META_SYNC_QUEUE = 'meta-sync'
export const META_SYNC_DLQ = `${META_SYNC_QUEUE}-dlq`

export type MetaSyncJobData = {
  tenantId: string
  adAccountId: string
}

export type MetaSyncJobType =
  | 'sync-structure'
  | 'sync-insights-fresh'
  | 'sync-insights-historical'
  | 'sync-creatives'

type SyncJobTypePrisma = 'STRUCTURE' | 'INSIGHTS_FRESH' | 'INSIGHTS_HISTORICAL' | 'CREATIVES'

const JOB_TYPE_MAP: Record<MetaSyncJobType, SyncJobTypePrisma> = {
  'sync-structure': 'STRUCTURE',
  'sync-insights-fresh': 'INSIGHTS_FRESH',
  'sync-insights-historical': 'INSIGHTS_HISTORICAL',
  'sync-creatives': 'CREATIVES',
}

type ProcessableAdAccount = {
  id: string
  accountId: string
  client: { id: string; tenantId: string }
  metaConnection: { accessTokenEncrypted: string }
}

const CLIENT_LOCK_TTL_MS = 30 * 60 * 1000

@Injectable()
export class MetaSyncProcessor {
  private readonly logger = new Logger(MetaSyncProcessor.name)
  private readonly redis: Redis
  private readonly deadLetterQueue: Queue<MetaSyncJobData>
  private readonly worker: Worker<MetaSyncJobData>

  constructor(
    private readonly prisma: PrismaService,
    private readonly rateLimit: RateLimitHandler,
    private readonly metaApi: MetaApiAdapter,
  ) {
    const connection = {
      host: process.env['REDIS_HOST'] ?? 'localhost',
      port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
    }

    this.redis = new Redis(connection)
    this.deadLetterQueue = new Queue(META_SYNC_DLQ, { connection })

    this.worker = new Worker(
      META_SYNC_QUEUE,
      async (job: Job<MetaSyncJobData>) => this.process(job),
      {
        connection,
        concurrency: 5,
      },
    )

    this.worker.on('failed', async (job, err) => {
      this.logger.error(`Job ${job?.id} failed: ${err.message}`)
      if (job && job.attemptsMade >= (job.opts.attempts ?? 0)) {
        await this.deadLetterQueue.add(job.name, job.data, { removeOnComplete: true })
        this.logger.warn(`Moved job ${job.id} to DLQ`)
      }
    })
  }

  private async process(job: Job<MetaSyncJobData>): Promise<void> {
    const { tenantId, adAccountId } = job.data
    const jobType = job.name as MetaSyncJobType

    if (await this.rateLimit.isInCoolDown()) {
      throw new Error('Rate limit cooldown active')
    }

    const adAccount = await this.prisma.client.metaAdAccount.findFirst({
      where: { id: adAccountId },
      include: { metaConnection: true, client: true },
    })

    if (!adAccount?.metaConnection || !adAccount.client) {
      throw new Error(`AdAccount or MetaConnection not found: ${adAccountId}`)
    }

    if (adAccount.client.tenantId !== tenantId) {
      throw new Error(`Tenant mismatch for adAccount ${adAccountId}`)
    }

    const lockToken = await this.acquireClientLock(adAccount.client.id)
    const syncLog = await this.prisma.client.syncLog.create({
      data: {
        clientId: adAccount.client.id,
        jobType: JOB_TYPE_MAP[jobType],
        status: 'RUNNING',
        startedAt: new Date(),
      },
    })

    const startTime = Date.now()
    let processed = 0

    try {
      const token = decrypt(adAccount.metaConnection.accessTokenEncrypted)
      const processable: ProcessableAdAccount = adAccount

      switch (jobType) {
        case 'sync-structure':
          processed = await this.syncStructure(processable, token)
          break
        case 'sync-insights-fresh':
          processed = await this.syncInsightsFresh(processable, token)
          break
        case 'sync-insights-historical':
          processed = await this.syncInsightsHistorical(processable, token)
          break
        case 'sync-creatives':
          processed = await this.syncCreatives(processable, token)
          break
      }

      await this.prisma.client.syncLog.update({
        where: { id: syncLog.id },
        data: { status: 'COMPLETED', finishedAt: new Date(), durationMs: Date.now() - startTime, itemsProcessed: processed },
      })
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      await this.prisma.client.syncLog.update({
        where: { id: syncLog.id },
        data: { status: 'FAILED', finishedAt: new Date(), durationMs: Date.now() - startTime, itemsProcessed: processed, error },
      })
      throw err
    } finally {
      await this.releaseClientLock(adAccount.client.id, lockToken)
      await this.prisma.client.metaAdAccount.update({
        where: { id: adAccountId },
        data: { lastSyncedAt: new Date() },
      })
    }
  }

  private async syncStructure(adAccount: ProcessableAdAccount, token: string): Promise<number> {
    const [campaigns, adSets, ads] = await Promise.all([
      this.metaApi.getCampaigns(token, adAccount.accountId),
      this.metaApi.getAdSets(token, adAccount.accountId),
      this.metaApi.getAds(token, adAccount.accountId),
    ])

    await this.upsertCampaigns(campaigns, adAccount.id)
    const campaignMap = await this.loadCampaignMap(campaigns.map((c) => c.id))

    await this.upsertAdSets(adSets, campaignMap)
    const adSetMap = await this.loadAdSetMap(adSets.map((a) => a.id))

    await this.upsertAds(ads, adSetMap)

    return campaigns.length + adSets.length + ads.length
  }

  private async upsertCampaigns(campaigns: MetaCampaign[], adAccountId: string): Promise<void> {
    await Promise.all(
      campaigns.map((c) =>
        this.prisma.client.campaign.upsert({
          where: { metaCampaignId: c.id },
          create: {
            adAccountId,
            metaCampaignId: c.id,
            name: c.name,
            objective: c.objective,
            status: c.status,
            dailyBudget: c.daily_budget ?? null,
            lifetimeBudget: c.lifetime_budget ?? null,
            startTime: new Date(c.start_time),
            stopTime: c.stop_time ? new Date(c.stop_time) : null,
            createdTime: new Date(c.created_time),
            updatedTime: new Date(c.updated_time),
          },
          update: {
            name: c.name,
            objective: c.objective,
            status: c.status,
            dailyBudget: c.daily_budget ?? null,
            lifetimeBudget: c.lifetime_budget ?? null,
            startTime: new Date(c.start_time),
            stopTime: c.stop_time ? new Date(c.stop_time) : null,
            updatedTime: new Date(c.updated_time),
          },
        }),
      ),
    )
  }

  private async loadCampaignMap(metaIds: string[]): Promise<Map<string, string>> {
    const records = await this.prisma.client.campaign.findMany({
      where: { metaCampaignId: { in: metaIds } },
      select: { id: true, metaCampaignId: true },
    })
    return new Map(records.map((r) => [r.metaCampaignId, r.id]))
  }

  private async upsertAdSets(adSets: MetaAdSet[], campaignMap: Map<string, string>): Promise<void> {
    await Promise.all(
      adSets.map((a) => {
        const campaignId = campaignMap.get(a.campaign_id)
        if (!campaignId) return Promise.resolve()
        return this.prisma.client.adSet.upsert({
          where: { metaAdSetId: a.id },
          create: {
            campaignId,
            metaAdSetId: a.id,
            name: a.name,
            status: a.status,
            dailyBudget: a.daily_budget ?? null,
            lifetimeBudget: a.lifetime_budget ?? null,
            targeting: toJson(a.targeting ?? {}),
            optimizationGoal: a.optimization_goal,
            billingEvent: a.billing_event,
            startTime: new Date(a.start_time),
            endTime: a.end_time ? new Date(a.end_time) : null,
            createdTime: new Date(a.created_time),
            updatedTime: new Date(a.updated_time),
          },
          update: {
            name: a.name,
            status: a.status,
            dailyBudget: a.daily_budget ?? null,
            lifetimeBudget: a.lifetime_budget ?? null,
            targeting: toJson(a.targeting ?? {}),
            optimizationGoal: a.optimization_goal,
            billingEvent: a.billing_event,
            startTime: new Date(a.start_time),
            endTime: a.end_time ? new Date(a.end_time) : null,
            updatedTime: new Date(a.updated_time),
          },
        })
      }),
    )
  }

  private async loadAdSetMap(metaIds: string[]): Promise<Map<string, string>> {
    const records = await this.prisma.client.adSet.findMany({
      where: { metaAdSetId: { in: metaIds } },
      select: { id: true, metaAdSetId: true },
    })
    return new Map(records.map((r) => [r.metaAdSetId, r.id]))
  }

  private async upsertAds(ads: MetaAd[], adSetMap: Map<string, string>): Promise<void> {
    await Promise.all(
      ads.map((ad) => {
        const adSetId = adSetMap.get(ad.adset_id)
        if (!adSetId) return Promise.resolve()
        return this.prisma.client.ad.upsert({
          where: { metaAdId: ad.id },
          create: {
            adSetId,
            metaAdId: ad.id,
            name: ad.name,
            status: ad.status,
            creativeId: ad.creative_id,
            creativeData: toJson(ad.creative ?? {}),
            createdTime: new Date(ad.created_time),
            updatedTime: new Date(ad.updated_time),
          },
          update: {
            adSetId,
            name: ad.name,
            status: ad.status,
            creativeId: ad.creative_id,
            creativeData: toJson(ad.creative ?? {}),
            updatedTime: new Date(ad.updated_time),
          },
        })
      }),
    )
  }

  private async syncInsightsFresh(adAccount: ProcessableAdAccount, token: string): Promise<number> {
    const now = new Date()
    const since = new Date(now)
    since.setDate(now.getDate() - 3)
    const fmt = (d: Date) => d.toISOString().slice(0, 10)
    const [insightCount] = await Promise.all([
      this.syncInsights(adAccount, token, since, now),
      this.syncBreakdowns(adAccount, token, fmt(since), fmt(now)),
    ])
    return insightCount
  }

  private async syncInsightsHistorical(adAccount: ProcessableAdAccount, token: string): Promise<number> {
    const now = new Date()
    const since = new Date(now)
    since.setDate(now.getDate() - 60)
    return this.syncInsights(adAccount, token, since, now)
  }

  private async syncInsights(adAccount: ProcessableAdAccount, token: string, since: Date, until: Date): Promise<number> {
    const fmt = (d: Date) => d.toISOString().slice(0, 10)
    const [campaignRows, adSetRows, adRows] = await Promise.all([
      this.metaApi.getInsights(token, adAccount.accountId, 'campaign', fmt(since), fmt(until)),
      this.metaApi.getInsights(token, adAccount.accountId, 'adset', fmt(since), fmt(until)),
      this.metaApi.getInsights(token, adAccount.accountId, 'ad', fmt(since), fmt(until)),
    ])

    const [c, a, d] = await Promise.all([
      this.persistInsightRows('CAMPAIGN', campaignRows, 'campaign_id'),
      this.persistInsightRows('ADSET', adSetRows, 'adset_id'),
      this.persistInsightRows('AD', adRows, 'ad_id'),
    ])
    return c + a + d
  }

  private async persistInsightRows(
    entityType: 'CAMPAIGN' | 'ADSET' | 'AD',
    rows: MetaInsightRow[],
    entityKey: 'campaign_id' | 'adset_id' | 'ad_id',
  ): Promise<number> {
    let count = 0
    await Promise.all(
      rows.map((row) => {
        const entityId = row[entityKey]
        if (!entityId) return Promise.resolve()

        const date = new Date(row.date_start)
        const id = `${entityType}-${entityId}-${date.toISOString().slice(0, 10)}`
        count += 1

        const data = {
          entityType,
          entityId,
          date,
          spend: Number(row.spend ?? 0),
          impressions: Number(row.impressions ?? 0),
          reach: Number(row.reach ?? 0),
          clicks: Number(row.clicks ?? 0),
          frequency: row.frequency != null ? Number(row.frequency) : null,
          conversions: toJson(row.actions ?? []),
          videoMetrics: toJson(row.video_30_sec_watched_actions ?? []),
          breakdowns: row.breakdowns ? toJson(row.breakdowns) : Prisma.DbNull,
          raw: row as object,
        }

        return this.prisma.client.insight.upsert({ where: { id }, create: { id, ...data }, update: data })
      }),
    )
    return count
  }

  private async syncBreakdowns(adAccount: ProcessableAdAccount, token: string, since: string, until: string): Promise<void> {
    const DIMENSIONS = ['age', 'gender', 'device_platform', 'publisher_platform'] as const
    const results = await Promise.allSettled(
      DIMENSIONS.map((dim) => this.metaApi.getInsightsWithBreakdown(token, adAccount.accountId, dim, since, until)),
    )

    const breakdownsByKey = new Map<string, Record<string, MetaBreakdownRow[]>>()

    DIMENSIONS.forEach((dim, idx) => {
      const result = results[idx]
      if (result.status !== 'fulfilled') {
        this.logger.warn(`Breakdown ${dim} failed for account ${adAccount.accountId}`)
        return
      }
      for (const row of result.value) {
        const campaignId = row.campaign_id
        if (!campaignId) continue
        const existing = breakdownsByKey.get(campaignId) ?? {}
        const dimKey = dim === 'device_platform' ? 'device' : dim === 'publisher_platform' ? 'platform' : dim
        existing[dimKey] = [...(existing[dimKey] ?? []), row]
        breakdownsByKey.set(campaignId, existing)
      }
    })

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    await Promise.all(
      Array.from(breakdownsByKey.entries()).map(([metaCampaignId, breakdowns]) => {
        const id = `BREAKDOWN-${metaCampaignId}-${today.toISOString().slice(0, 10)}`
        const data = {
          entityType: 'CAMPAIGN' as const,
          entityId: metaCampaignId,
          date: today,
          spend: 0,
          impressions: 0,
          reach: 0,
          clicks: 0,
          frequency: null,
          conversions: toJson([]),
          videoMetrics: toJson([]),
          breakdowns: toJson(breakdowns),
          raw: {},
        }
        return this.prisma.client.insight.upsert({ where: { id }, create: { id, ...data }, update: { breakdowns: toJson(breakdowns) } })
      }),
    )
  }

  private async syncCreatives(adAccount: ProcessableAdAccount, token: string): Promise<number> {
    const creatives = await this.metaApi.getAdCreatives(token, adAccount.accountId)
    const adSetIds = [...new Set(creatives.map((c) => c.adset_id).filter(Boolean))]
    const adSetMap = await this.loadAdSetMap(adSetIds)

    await Promise.all(
      creatives.map((ad) => {
        const adSetId = adSetMap.get(ad.adset_id)
        if (!adSetId) return Promise.resolve()
        return this.prisma.client.ad.upsert({
          where: { metaAdId: ad.id },
          create: {
            adSetId,
            metaAdId: ad.id,
            name: ad.name,
            status: ad.status,
            creativeId: ad.creative_id,
            creativeData: toJson(ad.creative ?? {}),
            createdTime: new Date(),
            updatedTime: new Date(),
          },
          update: { name: ad.name, status: ad.status, creativeId: ad.creative_id, creativeData: toJson(ad.creative ?? {}), updatedTime: new Date() },
        })
      }),
    )
    return creatives.length
  }

  private async acquireClientLock(clientId: string): Promise<string> {
    const lockKey = `meta_sync_lock:client:${clientId}`
    const lockToken = randomUUID()
    const result = await this.redis.set(lockKey, lockToken, 'PX', CLIENT_LOCK_TTL_MS, 'NX')
    if (result !== 'OK') throw new Error(`Client ${clientId} already has an active sync`)
    return lockToken
  }

  private async releaseClientLock(clientId: string, lockToken: string): Promise<void> {
    const lockKey = `meta_sync_lock:client:${clientId}`
    const script = `if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) end return 0`
    await this.redis.eval(script, 1, lockKey, lockToken)
  }
}
