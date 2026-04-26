import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { PrismaService } from './prisma.service'
import { Queue } from 'bullmq'
import { META_SYNC_QUEUE, MetaSyncJobData } from './meta-sync.processor'

@Injectable()
export class MetaSyncScheduler {
  private readonly logger = new Logger(MetaSyncScheduler.name)
  private readonly queue: Queue<MetaSyncJobData>

  constructor(private readonly prisma: PrismaService) {
    this.queue = new Queue(META_SYNC_QUEUE, {
      connection: {
        host: process.env['REDIS_HOST'] ?? 'localhost',
        port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
      },
    })
  }

  @Cron(CronExpression.EVERY_HOUR)
  async scheduleStructureSync(): Promise<void> {
    this.logger.log('Scheduling structure sync jobs')

    const adAccounts = await this.prisma.client.metaAdAccount.findMany({
      where: { metaConnection: { status: 'ACTIVE' } },
      include: { client: true },
    })

    for (const account of adAccounts) {
      await this.queue.add(
        'sync-structure',
        { tenantId: account.client.tenantId, adAccountId: account.id },
        { priority: 1 },
      )
    }
  }

  @Cron('0 */15 * * * *') // Every 15 minutes
  async scheduleFreshInsightsSync(): Promise<void> {
    this.logger.log('Scheduling fresh insights sync jobs')

    const adAccounts = await this.prisma.client.metaAdAccount.findMany({
      where: { metaConnection: { status: 'ACTIVE' } },
      include: { client: true },
    })

    for (const account of adAccounts) {
      await this.queue.add(
        'sync-insights-fresh',
        { tenantId: account.client.tenantId, adAccountId: account.id },
        { priority: 2 },
      )
    }
  }

  @Cron('0 3 * * *') // Daily at 3 AM
  async scheduleHistoricalInsightsSync(): Promise<void> {
    this.logger.log('Scheduling historical insights sync jobs')

    const adAccounts = await this.prisma.client.metaAdAccount.findMany({
      where: { metaConnection: { status: 'ACTIVE' } },
      include: { client: true },
    })

    for (const account of adAccounts) {
      await this.queue.add(
        'sync-insights-historical',
        { tenantId: account.client.tenantId, adAccountId: account.id },
        { priority: 3 },
      )
    }
  }

  @Cron('0 */6 * * *') // Every 6 hours
  async scheduleCreativesSync(): Promise<void> {
    this.logger.log('Scheduling creatives sync jobs')

    const adAccounts = await this.prisma.client.metaAdAccount.findMany({
      where: { metaConnection: { status: 'ACTIVE' } },
      include: { client: true },
    })

    for (const account of adAccounts) {
      await this.queue.add(
        'sync-creatives',
        { tenantId: account.client.tenantId, adAccountId: account.id },
        { priority: 4 },
      )
    }
  }
}