import { Module } from '@nestjs/common'
import { AudienceAnalysisService } from './audience-analysis.service'
import { AudienceAnalysisController } from './audience-analysis.controller'

@Module({
  controllers: [AudienceAnalysisController],
  providers: [AudienceAnalysisService],
})
export class AudienceAnalysisModule {}
