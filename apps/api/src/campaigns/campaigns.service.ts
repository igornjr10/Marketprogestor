import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

type CampaignFilters = {
  status?: string
  page: number
  limit: number
}

type InsightRow = {
  spend: number
  impressions: number
  reach: number
  clicks: number
  date: Date
}

@Injectable()
export class CampaignsService {
  constructor(private readonly prisma: PrismaService) {}

  async findByClient(tenantId: string, clientId: string, filters: CampaignFilters) {
    await this.assertClientAccess(tenantId, clientId)

    const adAccountIds = await this.getAdAccountIds(clientId)

    const where = {
      adAccountId: { in: adAccountIds },
      ...(filters.status ? { status: filters.status } : {}),
    }

    const [campaigns, total] = await Promise.all([
      this.prisma.client.campaign.findMany({
        where,
        orderBy: { updatedTime: 'desc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      this.prisma.client.campaign.count({ where }),
    ])

    return {
      campaigns,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        pages: Math.ceil(total / filters.limit),
      },
    }
  }

  async findOne(tenantId: string, clientId: string, campaignId: string) {
    await this.assertClientAccess(tenantId, clientId)

    const campaign = await this.prisma.client.campaign.findFirst({
      where: { id: campaignId, adAccount: { clientId } },
      include: {
        adSets: {
          orderBy: { updatedTime: 'desc' },
          include: {
            ads: { orderBy: { updatedTime: 'desc' } },
          },
        },
      },
    })
    if (!campaign) throw new NotFoundException('Campanha não encontrada')
    return campaign
  }

  async getInsights(tenantId: string, clientId: string, period = 30) {
    await this.assertClientAccess(tenantId, clientId)

    const adAccountIds = await this.getAdAccountIds(clientId)
    const campaignMetaIds = await this.getCampaignMetaIds(adAccountIds)

    if (campaignMetaIds.length === 0) {
      return { totals: { spend: 0, impressions: 0, reach: 0, clicks: 0, ctr: 0, cpm: 0, cpc: 0 }, byDate: [] }
    }

    const since = new Date()
    since.setDate(since.getDate() - period)

    const insights = await this.prisma.client.insight.findMany({
      where: {
        entityType: 'CAMPAIGN',
        entityId: { in: campaignMetaIds },
        date: { gte: since },
      },
      orderBy: { date: 'asc' },
    })

    return this.aggregate(insights)
  }

  private async assertClientAccess(tenantId: string, clientId: string) {
    const client = await this.prisma.client.client.findFirst({
      where: { id: clientId, tenantId, status: { not: 'DELETED' } },
    })
    if (!client) throw new NotFoundException('Client não encontrado')
  }

  private async getAdAccountIds(clientId: string): Promise<string[]> {
    const accounts = await this.prisma.client.metaAdAccount.findMany({
      where: { clientId },
      select: { id: true },
    })
    return accounts.map((a) => a.id)
  }

  private async getCampaignMetaIds(adAccountIds: string[]): Promise<string[]> {
    const campaigns = await this.prisma.client.campaign.findMany({
      where: { adAccountId: { in: adAccountIds } },
      select: { metaCampaignId: true },
    })
    return campaigns.map((c) => c.metaCampaignId)
  }

  private aggregate(insights: InsightRow[]) {
    const totals = insights.reduce(
      (acc, i) => ({
        spend: acc.spend + i.spend,
        impressions: acc.impressions + i.impressions,
        reach: acc.reach + i.reach,
        clicks: acc.clicks + i.clicks,
      }),
      { spend: 0, impressions: 0, reach: 0, clicks: 0 },
    )

    const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0
    const cpm = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0
    const cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0

    const byDateMap = insights.reduce<Record<string, { spend: number; clicks: number; impressions: number }>>(
      (acc, i) => {
        const date = i.date.toISOString().slice(0, 10)
        if (!acc[date]) acc[date] = { spend: 0, clicks: 0, impressions: 0 }
        acc[date].spend += i.spend
        acc[date].clicks += i.clicks
        acc[date].impressions += i.impressions
        return acc
      },
      {},
    )

    return {
      totals: {
        ...totals,
        ctr: Math.round(ctr * 100) / 100,
        cpm: Math.round(cpm * 100) / 100,
        cpc: Math.round(cpc * 100) / 100,
      },
      byDate: Object.entries(byDateMap).map(([date, metrics]) => ({ date, ...metrics })),
    }
  }
}
