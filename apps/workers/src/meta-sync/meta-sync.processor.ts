import { Injectable, Logger } from '@nestjs/common'
import { Worker, Job, Queue, QueueScheduler } from 'bullmq'
import Redis from 'ioredis'
import { randomUUID } from 'crypto'
import { PrismaService } from './prisma.service'
import { decrypt } from '@marketproads/crypto'
import { RateLimitHandler } from './rate-limit.handler'
import { MetaApiAdapter } from '../integrations/meta-api.adapter'

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

const CLIENT_LOCK_TTL_MS = 30 * 60 * 1000

@Injectable()
export class MetaSyncProcessor {
  private readonly logger = new Logger(MetaSyncProcessor.name)
  private readonly redis: Redis
  private readonly deadLetterQueue: Queue<MetaSyncJobData>
  private readonly worker: Worker<MetaSyncJobData>
  private readonly scheduler: QueueScheduler

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
    this.scheduler = new QueueScheduler(META_SYNC_QUEUE, { connection })
    this.deadLetterQueue = new Queue(META_SYNC_DLQ, { connection })

    this.worker = new Worker(
      META_SYNC_QUEUE,
      async (job: Job<MetaSyncJobData>) => this.process(job),
      {
        connection,
        concurrency: 5,
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: 500,
          removeOnFail: 100,
        },
      },
    )

    this.worker.on('failed', async (job, err) => {
      this.logger.error(`Job ${job?.id} failed: ${err.message}`)
      if (job && job.attemptsMade >= (job.opts.attempts ?? 0)) {
        await this.deadLetterQueue.add(job.name, job.data, {
          removeOnComplete: true,
        })
        this.logger.warn(`Moved job ${job.id} to DLQ`)
      }
    })
  }

  private async process(job: Job<MetaSyncJobData>): Promise<void> {
    const { tenantId, adAccountId } = job.data
    const jobType = job.name as MetaSyncJobType

    this.logger.log(`Processing ${jobType} for adAccount=${adAccountId}, tenant=${tenantId}`)

    if (await this.rateLimit.isInCoolDown()) {
      this.logger.warn(`Skipping job due to rate limit cooldown`)
      throw new Error('Rate limit cooldown active')
    }

    const adAccount = await this.prisma.client.metaAdAccount.findFirst({
      where: { id: adAccountId },
      include: { metaConnection: true, client: true },
    })

    if (!adAccount || !adAccount.metaConnection || !adAccount.client) {
      throw new Error(`AdAccount or MetaConnection not found: ${adAccountId}`)
    }

    const lockToken = await this.acquireClientLock(adAccount.client.id)
    const syncLog = await this.prisma.client.syncLog.create({
      data: {
        clientId: adAccount.client.id,
        jobType: jobType.toUpperCase() as any,
        status: 'RUNNING',
        startedAt: new Date(),
      },
    })

    const startTime = Date.now()
    let processed = 0
    let error: string | null = null

    try {
      const token = decrypt(adAccount.metaConnection.accessTokenEncrypted)
      switch (jobType) {
        case 'sync-structure':
          processed = await this.syncStructure(adAccount, token)
          break
        case 'sync-insights-fresh':
          processed = await this.syncInsightsFresh(adAccount, token)
          break
        case 'sync-insights-historical':
          processed = await this.syncInsightsHistorical(adAccount, token)
          break
        case 'sync-creatives':
          processed = await this.syncCreatives(adAccount, token)
          break
        default:
          throw new Error(`Unknown job type: ${jobType}`)
      }

      await this.prisma.client.syncLog.update({
        where: { id: syncLog.id },
        data: {
          status: 'COMPLETED',
          finishedAt: new Date(),
          durationMs: Date.now() - startTime,
          itemsProcessed: processed,
        },
      })
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
      await this.prisma.client.syncLog.update({
        where: { id: syncLog.id },
        data: {
          status: 'FAILED',
          finishedAt: new Date(),
          durationMs: Date.now() - startTime,
          itemsProcessed: processed,
          error,
        },
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

  private async syncStructure(adAccount: any, token: string): Promise<number> {
    this.logger.log(`Syncing structure for account ${adAccount.accountId}`)

    const campaigns = await this.metaApi.getCampaigns(token, adAccount.accountId)
    let processed = 0

    await Promise.all(
      campaigns.map(async (campaign) => {
        const campaignRecord = await this.prisma.campaign.upsert({
          where: { metaCampaignId: campaign.id },
          create: {
            adAccountId: adAccount.id,
            metaCampaignId: campaign.id,
            name: campaign.name,
            objective: campaign.objective,
            status: campaign.status,
            dailyBudget: campaign.daily_budget ?? null,
            lifetimeBudget: campaign.lifetime_budget ?? null,
            startTime: new Date(campaign.start_time),
            stopTime: campaign.stop_time ? new Date(campaign.stop_time) : null,
            createdTime: new Date(campaign.created_time),
            updatedTime: new Date(campaign.updated_time),
          },
          update: {
            name: campaign.name,
            objective: campaign.objective,
            status: campaign.status,
            dailyBudget: campaign.daily_budget ?? null,
            lifetimeBudget: campaign.lifetime_budget ?? null,
            startTime: new Date(campaign.start_time),
            stopTime: campaign.stop_time ? new Date(campaign.stop_time) : null,
            updatedTime: new Date(campaign.updated_time),
          },
        })

        processed += 1
        return campaignRecord
      }),
    )

    const adSets = await this.metaApi.getAdSets(token, adAccount.accountId)
    await Promise.all(
      adSets.map(async (adSet) => {
        const campaign = await this.prisma.campaign.findUnique({
          where: { metaCampaignId: adSet.campaign_id },
        })
        if (!campaign) return

        await this.prisma.adSet.upsert({
          where: { metaAdSetId: adSet.id },
          create: {
            campaignId: campaign.id,
            metaAdSetId: adSet.id,
            name: adSet.name,
            status: adSet.status,
            dailyBudget: adSet.daily_budget ?? null,
            lifetimeBudget: adSet.lifetime_budget ?? null,
            targeting: adSet.targeting ?? {},
            optimizationGoal: adSet.optimization_goal,
            billingEvent: adSet.billing_event,
            startTime: new Date(adSet.start_time),
            endTime: adSet.end_time ? new Date(adSet.end_time) : null,
            createdTime: new Date(adSet.created_time),
            updatedTime: new Date(adSet.updated_time),
          },
          update: {
            name: adSet.name,
            status: adSet.status,
            dailyBudget: adSet.daily_budget ?? null,
            lifetimeBudget: adSet.lifetime_budget ?? null,
            targeting: adSet.targeting ?? {},
            optimizationGoal: adSet.optimization_goal,
            billingEvent: adSet.billing_event,
            startTime: new Date(adSet.start_time),
            endTime: adSet.end_time ? new Date(adSet.end_time) : null,
            updatedTime: new Date(adSet.updated_time),
          },
        })
        processed += 1
      }),
    )

    const ads = await this.metaApi.getAds(token, adAccount.accountId)
    await Promise.all(
      ads.map(async (ad) => {
        const adSet = await this.prisma.adSet.findUnique({
          where: { metaAdSetId: ad.adset_id },
        })
        if (!adSet) return

        await this.prisma.ad.upsert({
          where: { metaAdId: ad.id },
          create: {
            adSetId: adSet.id,
            metaAdId: ad.id,
            name: ad.name,
            status: ad.status,
            creativeId: ad.creative_id,
            creativeData: ad.creative ?? {},
            createdTime: new Date(ad.created_time),
            updatedTime: new Date(ad.updated_time),
          },
          update: {
            adSetId: adSet.id,
            name: ad.name,
            status: ad.status,
            creativeId: ad.creative_id,
            creativeData: ad.creative ?? {},
            updatedTime: new Date(ad.updated_time),
          },
        })
        processed += 1
      }),
    )

    return processed
  }

  private async syncInsightsFresh(adAccount: any, token: string): Promise<number> {
    this.logger.log(`Syncing fresh insights for account ${adAccount.accountId}`)
    const now = new Date()
    const since = new Date(now)
    since.setDate(now.getDate() - 3)
    return this.syncInsights(adAccount, token, since, now)
  }

  private async syncInsightsHistorical(adAccount: any, token: string): Promise<number> {
    this.logger.log(`Syncing historical insights for account ${adAccount.accountId}`)
    const now = new Date()
    const since = new Date(now)
    since.setDate(now.getDate() - 60)
    return this.syncInsights(adAccount, token, since, now)
  }

  private async syncInsights(adAccount: any, token: string, since: Date, until: Date): Promise<number> {
    const [campaignRows, adSetRows, adRows] = await Promise.all([
      this.metaApi.getInsights(token, adAccount.accountId, 'campaign', this.formatDate(since), this.formatDate(until)),
      this.metaApi.getInsights(token, adAccount.accountId, 'adset', this.formatDate(since), this.formatDate(until)),
      this.metaApi.getInsights(token, adAccount.accountId, 'ad', this.formatDate(since), this.formatDate(until)),
    ])

    let processed = 0
    processed += await this.persistInsightRows('CAMPAIGN', campaignRows, 'campaign_id')
    processed += await this.persistInsightRows('ADSET', adSetRows, 'adset_id')
    processed += await this.persistInsightRows('AD', adRows, 'ad_id')
    return processed
  }

  private async persistInsightRows(
    entityType: 'CAMPAIGN' | 'ADSET' | 'AD',
    rows: Array<any>,
    entityKey: 'campaign_id' | 'adset_id' | 'ad_id',
  ): Promise<number> {
    let count = 0
    await Promise.all(
      rows.map(async (row) => {
        const entityId = row[entityKey]
        if (!entityId) return

        const date = new Date(row.date_start)
        const insightId = `${entityType}-${entityId}-${date.toISOString().slice(0, 10)}`

        await this.prisma.insight.upsert({
          where: { id: insightId },
          create: {
            id: insightId,
            entityType,
            entityId,
            date,
            spend: Number(row.spend ?? 0),
            impressions: Number(row.impressions ?? 0),
            reach: Number(row.reach ?? 0),
            clicks: Number(row.clicks ?? 0),
            conversions: row.actions ?? [],
            videoMetrics: row.video_30_sec_watched_actions ?? [],
            breakdowns: row.breakdowns ?? null,
            raw: row,
          },
          update: {
            spend: Number(row.spend ?? 0),
            impressions: Number(row.impressions ?? 0),
            reach: Number(row.reach ?? 0),
            clicks: Number(row.clicks ?? 0),
            conversions: row.actions ?? [],
            videoMetrics: row.video_30_sec_watched_actions ?? [],
            breakdowns: row.breakdowns ?? null,
            raw: row,
          },
        })
        count += 1
      }),
    )
    return count
  }

  private async syncCreatives(adAccount: any, token: string): Promise<number> {
    this.logger.log(`Syncing creatives for account ${adAccount.accountId}`)
    const creatives = await this.metaApi.getAdCreatives(token, adAccount.accountId)
    let processed = 0

    await Promise.all(
      creatives.map(async (ad) => {
        const adSet = await this.prisma.adSet.findUnique({ where: { metaAdSetId: ad.adset_id } })
        if (!adSet) return

        await this.prisma.ad.upsert({
          where: { metaAdId: ad.id },
          create: {
            adSetId: adSet.id,
            metaAdId: ad.id,
            name: ad.name,
            status: ad.status,
            creativeId: ad.creative_id,
            creativeData: ad.creative ?? {},
            createdTime: new Date(),
            updatedTime: new Date(),
          },
          update: {
            name: ad.name,
            status: ad.status,
            creativeId: ad.creative_id,
            creativeData: ad.creative ?? {},
            updatedTime: new Date(),
          },
        })
        processed += 1
      }),
    )
    return processed
  }

  private async acquireClientLock(clientId: string): Promise<string> {
    const lockKey = `meta_sync_lock:client:${clientId}`
    const lockToken = randomUUID()
    const result = await this.redis.set(lockKey, lockToken, 'PX', CLIENT_LOCK_TTL_MS, 'NX')

    if (result !== 'OK') {
      throw new Error(`Client ${clientId} already has an active sync`) 
    }

    return lockToken
  }

  private async releaseClientLock(clientId: string, lockToken: string): Promise<void> {
    const lockKey = `meta_sync_lock:client:${clientId}`
    const script = `
      if redis.call('get', KEYS[1]) == ARGV[1] then
        return redis.call('del', KEYS[1])
      end
      return 0
    `
    await this.redis.eval(script, 1, lockKey, lockToken)
  }

  private formatDate(date: Date): string {
    return date.toISOString().slice(0, 10)
  }
}
