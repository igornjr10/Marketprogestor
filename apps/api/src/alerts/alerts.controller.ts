import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common'
import { JwtGuard } from '../auth/guards/jwt.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { AlertsService } from './alerts.service'
import type { JwtPayload, CreateAlertDto, UpdateAlertDto } from '@marketproads/types'
import { ALERT_TEMPLATES } from '@marketproads/types'

@Controller('alerts')
@UseGuards(JwtGuard)
export class AlertsController {
  constructor(private readonly service: AlertsService) {}

  @Get('templates')
  getTemplates() {
    return ALERT_TEMPLATES
  }

  @Get()
  getAlerts(
    @CurrentUser() user: JwtPayload,
    @Query('clientId') clientId?: string,
  ) {
    return this.service.getAlerts(user.tenantId, clientId)
  }

  @Post()
  createAlert(
    @CurrentUser() user: JwtPayload,
    @Body() body: CreateAlertDto,
  ) {
    return this.service.createAlert(user.tenantId, user.sub, body)
  }

  @Patch(':alertId')
  updateAlert(
    @CurrentUser() user: JwtPayload,
    @Param('alertId') alertId: string,
    @Body() body: UpdateAlertDto,
  ) {
    return this.service.updateAlert(user.tenantId, alertId, body)
  }

  @Delete(':alertId')
  deleteAlert(
    @CurrentUser() user: JwtPayload,
    @Param('alertId') alertId: string,
  ) {
    return this.service.deleteAlert(user.tenantId, alertId)
  }

  @Post(':alertId/test')
  testAlert(
    @CurrentUser() user: JwtPayload,
    @Param('alertId') alertId: string,
  ) {
    return this.service.testAlert(user.tenantId, alertId)
  }

  @Get(':alertId/events')
  getAlertEvents(
    @CurrentUser() user: JwtPayload,
    @Param('alertId') alertId: string,
    @Query('status') status?: string,
  ) {
    return this.service.getAlertEvents(user.tenantId, alertId, status)
  }

  @Get('badge/count')
  getOpenCount(@CurrentUser() user: JwtPayload) {
    return this.service.getOpenEventsCount(user.tenantId)
  }
}

@Controller('alert-events')
@UseGuards(JwtGuard)
export class AlertEventsController {
  constructor(private readonly service: AlertsService) {}

  @Get()
  getEvents(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: string,
  ) {
    return this.service.getAlertEvents(user.tenantId, undefined, status)
  }

  @Patch(':eventId/resolve')
  resolve(
    @CurrentUser() user: JwtPayload,
    @Param('eventId') eventId: string,
  ) {
    return this.service.resolveAlertEvent(user.tenantId, eventId)
  }
}
