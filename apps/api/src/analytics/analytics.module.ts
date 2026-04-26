import { Module } from '@nestjs/common'
import { MetricsService } from './metrics.service'
import { AnalyticsController } from './analytics.controller'

@Module({
  controllers: [AnalyticsController],
  providers: [MetricsService],
})
export class AnalyticsModule {}
