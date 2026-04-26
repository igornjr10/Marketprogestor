import { Module } from '@nestjs/common'
import { MetaApiAdapter } from './meta-api.adapter'

@Module({
  providers: [MetaApiAdapter],
  exports: [MetaApiAdapter],
})
export class MetaApiModule {}
