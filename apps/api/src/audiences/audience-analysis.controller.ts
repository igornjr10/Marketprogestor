import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common'
import { JwtGuard } from '../auth/guards/jwt.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { AudienceAnalysisService } from './audience-analysis.service'
import type { JwtPayload } from '@marketproads/types'

@Controller('clients/:clientId')
@UseGuards(JwtGuard)
export class AudienceAnalysisController {
  constructor(private readonly service: AudienceAnalysisService) {}

  @Get('breakdowns')
  getBreakdown(
    @CurrentUser() user: JwtPayload,
    @Param('clientId') clientId: string,
    @Query('dimension') dimension = 'age',
    @Query('period') period = '30',
  ) {
    return this.service.getBreakdown(user.tenantId, clientId, dimension, parseInt(period, 10))
  }

  @Get('breakdowns/heatmap')
  getHeatmap(
    @CurrentUser() user: JwtPayload,
    @Param('clientId') clientId: string,
    @Query('dim1') dim1 = 'age',
    @Query('dim2') dim2 = 'gender',
    @Query('period') period = '30',
  ) {
    return this.service.getHeatmap(user.tenantId, clientId, dim1, dim2, parseInt(period, 10))
  }
}
