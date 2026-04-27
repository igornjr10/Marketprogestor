import { Module } from '@nestjs/common'
import { AlertsService } from './alerts.service'
import { AlertsController, AlertEventsController } from './alerts.controller'

@Module({
  controllers: [AlertsController, AlertEventsController],
  providers: [AlertsService],
  exports: [AlertsService],
})
export class AlertsModule {}
