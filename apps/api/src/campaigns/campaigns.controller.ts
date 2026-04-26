import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common'
import { CampaignsService } from './campaigns.service'
import { JwtGuard } from '../auth/guards/jwt.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import type { JwtPayload } from '@marketproads/types'

@Controller('clients/:clientId/campaigns')
@UseGuards(JwtGuard)
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get()
  findAll(
    @CurrentUser() user: JwtPayload,
    @Param('clientId') clientId: string,
    @Query('status') status?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.campaignsService.findByClient(user.tenantId, clientId, {
      status,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    })
  }

  @Get('insights')
  getInsights(
    @CurrentUser() user: JwtPayload,
    @Param('clientId') clientId: string,
    @Query('period') period = '30',
  ) {
    return this.campaignsService.getInsights(user.tenantId, clientId, parseInt(period, 10))
  }

  @Get(':campaignId')
  findOne(
    @CurrentUser() user: JwtPayload,
    @Param('clientId') clientId: string,
    @Param('campaignId') campaignId: string,
  ) {
    return this.campaignsService.findOne(user.tenantId, clientId, campaignId)
  }
}
