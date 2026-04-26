import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common'
import { MetricsService } from './metrics.service'
import { JwtGuard } from '../auth/guards/jwt.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import type { JwtPayload } from '@marketproads/types'

@Controller('clients/:clientId')
@UseGuards(JwtGuard)
export class AnalyticsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get('overview')
  getOverview(
    @CurrentUser() user: JwtPayload,
    @Param('clientId') clientId: string,
    @Query('period') period = '30',
    @Query('compare') compare = 'false',
  ) {
    return this.metrics.getOverview(user.tenantId, clientId, parseInt(period, 10), compare === 'true')
  }

  @Get('time-series')
  getTimeSeries(
    @CurrentUser() user: JwtPayload,
    @Param('clientId') clientId: string,
    @Query('period') period = '30',
    @Query('granularity') granularity = 'day',
    @Query('metrics') metricsParam = 'spend',
  ) {
    const metrics = metricsParam.split(',').map((m) => m.trim()).filter(Boolean)
    return this.metrics.getTimeSeries(user.tenantId, clientId, parseInt(period, 10), granularity, metrics)
  }

  @Get('campaigns-metrics')
  getCampaignMetrics(
    @CurrentUser() user: JwtPayload,
    @Param('clientId') clientId: string,
    @Query('period') period = '30',
    @Query('status') status?: string,
    @Query('sort') sort?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    let sortBy: string | undefined
    let sortDir: 'asc' | 'desc' = 'desc'
    if (sort) {
      const [field, dir] = sort.split(':')
      sortBy = field
      if (dir === 'asc') sortDir = 'asc'
    }

    return this.metrics.getCampaignMetricsPage(user.tenantId, clientId, {
      period: parseInt(period, 10),
      status: status || undefined,
      sortBy,
      sortDir,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    })
  }
}
