import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule'
import { MetaSyncModule } from './meta-sync/meta-sync.module'
import { AlertEvaluationModule } from './alert-evaluation/alert-evaluation.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    MetaSyncModule,
    AlertEvaluationModule,
  ],
})
export class WorkersModule {}
