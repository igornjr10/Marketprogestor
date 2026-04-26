import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { MetaSyncModule } from './meta-sync/meta-sync.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MetaSyncModule,
  ],
})
export class WorkersModule {}
