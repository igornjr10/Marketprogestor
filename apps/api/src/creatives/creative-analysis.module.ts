import { Module } from '@nestjs/common'
import { CreativeAnalysisService } from './creative-analysis.service'
import { CreativeAnalysisController } from './creative-analysis.controller'

@Module({
  controllers: [CreativeAnalysisController],
  providers: [CreativeAnalysisService],
})
export class CreativeAnalysisModule {}
