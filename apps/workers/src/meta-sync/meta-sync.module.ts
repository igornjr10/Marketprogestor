import { Module } from '@nestjs/common'
import { MetaSyncProcessor } from './meta-sync.processor'
import { MetaSyncScheduler } from './meta-sync.scheduler'
import { RateLimitHandler } from './rate-limit.handler'
import { DatabaseModule } from './prisma.module'
import { MetaApiAdapter } from '../integrations/meta-api.adapter'

@Module({
  imports: [DatabaseModule],
  providers: [MetaSyncProcessor, MetaSyncScheduler, RateLimitHandler, MetaApiAdapter],
})
export class MetaSyncModule {}
