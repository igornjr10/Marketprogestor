import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common'
import { JwtGuard } from '../auth/guards/jwt.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { CreativeAnalysisService } from './creative-analysis.service'
import type { JwtPayload } from '@marketproads/types'

@Controller('clients/:clientId')
@UseGuards(JwtGuard)
export class CreativeAnalysisController {
  constructor(private readonly service: CreativeAnalysisService) {}

  @Get('creatives')
  getGallery(
    @CurrentUser() user: JwtPayload,
    @Param('clientId') clientId: string,
    @Query('period') period = '30',
    @Query('sort') sort = 'spend:desc',
    @Query('fatigue') fatigueFilter?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.service.getCreativesGallery(user.tenantId, clientId, {
      period: parseInt(period, 10),
      sort,
      fatigueFilter,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    })
  }

  @Get('creatives/:adId/details')
  getDetails(
    @CurrentUser() user: JwtPayload,
    @Param('clientId') clientId: string,
    @Param('adId') adId: string,
    @Query('period') period = '30',
  ) {
    return this.service.getCreativeMetrics(user.tenantId, clientId, adId, parseInt(period, 10))
  }

  @Get('creatives/:adId/timeline')
  getTimeline(
    @CurrentUser() user: JwtPayload,
    @Param('clientId') clientId: string,
    @Param('adId') adId: string,
  ) {
    return this.service.getCreativeTimeline(user.tenantId, clientId, adId)
  }
}
