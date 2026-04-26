import { Injectable, Logger } from '@nestjs/common'
import { Worker, Job } from 'bullmq'

export const META_SYNC_QUEUE = 'meta-sync'

export type MetaSyncJobData = {
  tenantId: string
  adAccountId: string
}

@Injectable()
export class MetaSyncProcessor {
  private readonly logger = new Logger(MetaSyncProcessor.name)
  private worker: Worker

  constructor() {
    this.worker = new Worker(
      META_SYNC_QUEUE,
      async (job: Job<MetaSyncJobData>) => this.process(job),
      {
        connection: {
          host: process.env['REDIS_HOST'] ?? 'localhost',
          port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
        },
        concurrency: 5,
      },
    )

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Job ${job?.id} failed: ${err.message}`)
    })
  }

  private async process(job: Job<MetaSyncJobData>): Promise<void> {
    const { tenantId, adAccountId } = job.data
    this.logger.log(`Syncing adAccount=${adAccountId} for tenant=${tenantId}`)
    // MetaApiAdapter será injetado quando implementado
  }
}
