import { Module } from '@nestjs/common'
import { MetaSyncProcessor } from './meta-sync.processor'

@Module({
  providers: [MetaSyncProcessor],
})
export class MetaSyncModule {}
