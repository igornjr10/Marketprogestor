import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common'
import { JwtGuard } from '../auth/guards/jwt.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { AudienceAnalysisService } from './audience-analysis.service'
import type { JwtPayload } from '@marketproads/types'

const VALID_DIMENSIONS = ['age', 'gender', 'device', 'platform'] as const

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
    const parsedPeriod = Math.min(Math.max(parseInt(period, 10) || 30, 1), 90)
    const validDim = (VALID_DIMENSIONS as readonly string[]).includes(dimension) ? dimension : 'age'
    return this.service.getBreakdown(user.tenantId, clientId, validDim, parsedPeriod)
  }

  @Get('breakdowns/heatmap')
  getHeatmap(
    @CurrentUser() user: JwtPayload,
    @Param('clientId') clientId: string,
    @Query('dim1') dim1 = 'age',
    @Query('dim2') dim2 = 'gender',
    @Query('period') period = '30',
  ) {
    const parsedPeriod = Math.min(Math.max(parseInt(period, 10) || 30, 1), 90)
    const validDim1 = (VALID_DIMENSIONS as readonly string[]).includes(dim1) ? dim1 : 'age'
    const validDim2 = (VALID_DIMENSIONS as readonly string[]).includes(dim2) ? dim2 : 'gender'
    return this.service.getHeatmap(user.tenantId, clientId, validDim1, validDim2, parsedPeriod)
  }
}
