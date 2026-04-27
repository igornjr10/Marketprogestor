import { Module } from '@nestjs/common'
import { AlertEvaluationService } from './alert-evaluation.service'
import { DatabaseModule } from '../meta-sync/prisma.module'

@Module({
  imports: [DatabaseModule],
  providers: [AlertEvaluationService],
})
export class AlertEvaluationModule {}
