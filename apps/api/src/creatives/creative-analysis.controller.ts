import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common'
import { JwtGuard } from '../auth/guards/jwt.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { CreativeAnalysisService } from './creative-analysis.service'
import type { JwtPayload } from '@marketproads/types'

const VALID_SORTS = ['spend', 'ctr', 'frequency', 'impressions'] as const
const VALID_FATIGUE = ['ALL', 'NONE', 'MODERATE', 'SEVERE'] as const

@Controller('clients/:clientId')
@UseGuards(JwtGuard)
export class CreativeAnalysisController {
  constructor(private readonly service: CreativeAnalysisService) {}

  @Get('creatives')
  getGallery(
    @CurrentUser() user: JwtPayload,
    @Param('clientId') clientId: string,
    @Query('period') period = '30',
    @Query('sort') sort = 'spend',
    @Query('fatigue') fatigueFilter = 'ALL',
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const parsedPeriod = Math.min(Math.max(parseInt(period, 10) || 30, 1), 90)
    const parsedPage = Math.max(parseInt(page, 10) || 1, 1)
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100)
    const validSort = (VALID_SORTS as readonly string[]).includes(sort) ? sort : 'spend'
    const validFatigue = (VALID_FATIGUE as readonly string[]).includes(fatigueFilter) ? fatigueFilter : 'ALL'

    return this.service.getCreativesGallery(user.tenantId, clientId, {
      period: parsedPeriod,
      sort: `${validSort}:desc`,
      fatigueFilter: validFatigue,
      page: parsedPage,
      limit: parsedLimit,
    })
  }

  @Get('creatives/:adId/details')
  getDetails(
    @CurrentUser() user: JwtPayload,
    @Param('clientId') clientId: string,
    @Param('adId') adId: string,
    @Query('period') period = '30',
  ) {
    const parsedPeriod = Math.min(Math.max(parseInt(period, 10) || 30, 1), 90)
    return this.service.getCreativeMetrics(user.tenantId, clientId, adId, parsedPeriod)
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
