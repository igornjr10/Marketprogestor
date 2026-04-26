import { Controller, Get, Patch, Post, Param, Body, Query, UseGuards, Header, NotFoundException, Req } from '@nestjs/common'
import { CampaignsService } from './campaigns.service'
import { CampaignManagementService } from './campaign-management.service'
import { PrismaService } from '../prisma/prisma.service'
import { JwtGuard } from '../auth/guards/jwt.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import type { JwtPayload } from '@marketproads/types'

@Controller('clients/:clientId/campaigns')
@UseGuards(JwtGuard)
export class CampaignsController {
  constructor(
    private readonly campaignsService: CampaignsService,
    private readonly managementService: CampaignManagementService,
    private readonly prisma: PrismaService,
  ) {}

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

  // Management endpoints
  @Patch(':campaignId')
  async updateCampaign(
    @CurrentUser() user: JwtPayload,
    @Param('clientId') clientId: string,
    @Param('campaignId') campaignId: string,
    @Body() body: { status?: string; dailyBudget?: number; lifetimeBudget?: number },
    @Req() req: Request,
  ) {
    // Validate client access
    await this.campaignsService.findOne(user.tenantId, clientId, campaignId)

    const updates = []

    if (body.status !== undefined) {
      updates.push(
        this.managementService.toggleStatus({
          entityType: 'CAMPAIGN',
          entityId: campaignId,
          newStatus: body.status,
          userId: user.sub,
        }),
      )
    }

    if (body.dailyBudget !== undefined) {
      updates.push(
        this.managementService.updateBudget({
          entityType: 'CAMPAIGN',
          entityId: campaignId,
          budgetType: 'DAILY',
          value: body.dailyBudget,
          userId: user.sub,
        }),
      )
    }

    if (body.lifetimeBudget !== undefined) {
      updates.push(
        this.managementService.updateBudget({
          entityType: 'CAMPAIGN',
          entityId: campaignId,
          budgetType: 'LIFETIME',
          value: body.lifetimeBudget,
          userId: user.sub,
        }),
      )
    }

    return Promise.all(updates)
  }

  @Post(':campaignId/dry-run')
  async dryRunCampaign(
    @CurrentUser() user: JwtPayload,
    @Param('clientId') clientId: string,
    @Param('campaignId') campaignId: string,
    @Body() changes: { status?: string; dailyBudget?: number; lifetimeBudget?: number },
  ) {
    // Validate client access
    await this.campaignsService.findOne(user.tenantId, clientId, campaignId)

    return this.managementService.dryRun('CAMPAIGN', campaignId, changes)
  }

  @Post(':campaignId/duplicate')
  async duplicateCampaign(
    @CurrentUser() user: JwtPayload,
    @Param('clientId') clientId: string,
    @Param('campaignId') campaignId: string,
    @Body() body: { name: string; dailyBudget?: number; lifetimeBudget?: number; includeCreatives: boolean },
  ) {
    // Validate client access
    await this.campaignsService.findOne(user.tenantId, clientId, campaignId)

    return this.managementService.duplicateCampaign({
      campaignId,
      options: body,
      userId: user.sub,
    })
  }

  // AdSet management
  @Patch('adsets/:adSetId')
  async updateAdSet(
    @CurrentUser() user: JwtPayload,
    @Param('clientId') clientId: string,
    @Param('adSetId') adSetId: string,
    @Body() body: { status?: string; dailyBudget?: number; lifetimeBudget?: number },
    @Req() req: Request,
  ) {
    // Validate client access through campaign
    const adSet = await this.prisma.client.adSet.findUnique({
      where: { id: adSetId },
      include: { campaign: { include: { adAccount: { include: { client: true } } } } },
    })
    if (!adSet || adSet.campaign.adAccount.client.id !== clientId) {
      throw new NotFoundException('AdSet não encontrado')
    }

    const updates = []

    if (body.status !== undefined) {
      updates.push(
        this.managementService.toggleStatus({
          entityType: 'ADSET',
          entityId: adSetId,
          newStatus: body.status,
          userId: user.sub,
        }),
      )
    }

    if (body.dailyBudget !== undefined) {
      updates.push(
        this.managementService.updateBudget({
          entityType: 'ADSET',
          entityId: adSetId,
          budgetType: 'DAILY',
          value: body.dailyBudget,
          userId: user.sub,
        }),
      )
    }

    if (body.lifetimeBudget !== undefined) {
      updates.push(
        this.managementService.updateBudget({
          entityType: 'ADSET',
          entityId: adSetId,
          budgetType: 'LIFETIME',
          value: body.lifetimeBudget,
          userId: user.sub,
        }),
      )
    }

    return Promise.all(updates)
  }

  // Ad management
  @Patch('ads/:adId')
  async updateAd(
    @CurrentUser() user: JwtPayload,
    @Param('clientId') clientId: string,
    @Param('adId') adId: string,
    @Body() body: { status?: string },
    @Req() req: Request,
  ) {
    // Validate client access through campaign
    const ad = await this.prisma.client.ad.findUnique({
      where: { id: adId },
      include: {
        adSet: {
          include: {
            campaign: { include: { adAccount: { include: { client: true } } } },
          },
        },
      },
    })
    if (!ad || ad.adSet.campaign.adAccount.client.id !== clientId) {
      throw new NotFoundException('Ad não encontrado')
    }

    if (body.status !== undefined) {
      return this.managementService.toggleStatus({
        entityType: 'AD',
        entityId: adId,
        newStatus: body.status,
        userId: user.sub,
      })
    }
  }

  // Audit logs
  @Get('audit-logs')
  async getAuditLogs(
    @CurrentUser() user: JwtPayload,
    @Param('clientId') clientId: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    // Validate client access
    await this.campaignsService.findByClient(user.tenantId, clientId, { page: 1, limit: 1 })

    return this.prisma.rawClient.auditLog.findMany({
      where: {
        tenantId: user.tenantId,
        ...(entityType && { entityType }),
        ...(entityId && { entityId }),
      },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (parseInt(page, 10) - 1) * parseInt(limit, 10),
      take: parseInt(limit, 10),
    })
  }
}
