import { Test } from '@nestjs/testing'
import { NotFoundException } from '@nestjs/common'
import { CampaignsService } from './campaigns.service'
import { PrismaService } from '../prisma/prisma.service'

const mockPrisma = {
  client: {
    client: { findFirst: jest.fn() },
    metaAdAccount: { findMany: jest.fn() },
    campaign: { findMany: jest.fn(), findFirst: jest.fn(), count: jest.fn() },
    insight: { findMany: jest.fn() },
  },
}

describe('CampaignsService', () => {
  let service: CampaignsService

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CampaignsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile()

    service = module.get(CampaignsService)
    jest.clearAllMocks()
  })

  describe('findByClient', () => {
    it('throws when client not found for tenant', async () => {
      mockPrisma.client.client.findFirst.mockResolvedValue(null)

      await expect(
        service.findByClient('tenant-1', 'client-999', { page: 1, limit: 20 }),
      ).rejects.toThrow(NotFoundException)
    })

    it('returns paginated campaigns for client', async () => {
      mockPrisma.client.client.findFirst.mockResolvedValue({ id: 'c1' })
      mockPrisma.client.metaAdAccount.findMany.mockResolvedValue([{ id: 'acc1' }])
      mockPrisma.client.campaign.findMany.mockResolvedValue([
        { id: 'camp1', name: 'Campanha Teste', status: 'ACTIVE' },
      ])
      mockPrisma.client.campaign.count.mockResolvedValue(1)

      const result = await service.findByClient('tenant-1', 'c1', { page: 1, limit: 20 })

      expect(result.campaigns).toHaveLength(1)
      expect(result.pagination.total).toBe(1)
      expect(result.pagination.pages).toBe(1)
    })

    it('filters by status when provided', async () => {
      mockPrisma.client.client.findFirst.mockResolvedValue({ id: 'c1' })
      mockPrisma.client.metaAdAccount.findMany.mockResolvedValue([{ id: 'acc1' }])
      mockPrisma.client.campaign.findMany.mockResolvedValue([])
      mockPrisma.client.campaign.count.mockResolvedValue(0)

      await service.findByClient('tenant-1', 'c1', { status: 'PAUSED', page: 1, limit: 20 })

      const whereArg = mockPrisma.client.campaign.findMany.mock.calls[0][0].where
      expect(whereArg.status).toBe('PAUSED')
    })

    it('does not leak campaigns from other clients (tenancy)', async () => {
      mockPrisma.client.client.findFirst.mockResolvedValue(null)

      await expect(
        service.findByClient('tenant-2', 'client-1', { page: 1, limit: 20 }),
      ).rejects.toThrow(NotFoundException)

      expect(mockPrisma.client.campaign.findMany).not.toHaveBeenCalled()
    })
  })

  describe('findOne', () => {
    it('throws when campaign not found', async () => {
      mockPrisma.client.client.findFirst.mockResolvedValue({ id: 'c1' })
      mockPrisma.client.campaign.findFirst.mockResolvedValue(null)

      await expect(service.findOne('tenant-1', 'c1', 'camp-999')).rejects.toThrow(NotFoundException)
    })

    it('returns campaign with adsets and ads', async () => {
      mockPrisma.client.client.findFirst.mockResolvedValue({ id: 'c1' })
      mockPrisma.client.campaign.findFirst.mockResolvedValue({
        id: 'camp1',
        name: 'Campanha',
        adSets: [{ id: 'as1', ads: [{ id: 'ad1' }] }],
      })

      const result = await service.findOne('tenant-1', 'c1', 'camp1')

      expect(result.adSets).toHaveLength(1)
      expect(result.adSets[0].ads).toHaveLength(1)
    })
  })

  describe('getInsights', () => {
    it('returns zero totals when no campaigns exist', async () => {
      mockPrisma.client.client.findFirst.mockResolvedValue({ id: 'c1' })
      mockPrisma.client.metaAdAccount.findMany.mockResolvedValue([{ id: 'acc1' }])
      mockPrisma.client.campaign.findMany.mockResolvedValue([])

      const result = await service.getInsights('tenant-1', 'c1', 30)

      expect(result.totals.spend).toBe(0)
      expect(result.byDate).toEqual([])
    })

    it('aggregates insights and calculates derived metrics', async () => {
      mockPrisma.client.client.findFirst.mockResolvedValue({ id: 'c1' })
      mockPrisma.client.metaAdAccount.findMany.mockResolvedValue([{ id: 'acc1' }])
      mockPrisma.client.campaign.findMany.mockResolvedValue([{ metaCampaignId: 'meta-1' }])
      mockPrisma.client.insight.findMany.mockResolvedValue([
        { spend: 100, impressions: 10000, reach: 8000, clicks: 200, date: new Date('2026-04-01') },
        { spend: 50, impressions: 5000, reach: 4000, clicks: 100, date: new Date('2026-04-02') },
      ])

      const result = await service.getInsights('tenant-1', 'c1', 30)

      expect(result.totals.spend).toBe(150)
      expect(result.totals.impressions).toBe(15000)
      expect(result.totals.clicks).toBe(300)
      expect(result.totals.ctr).toBe(2) // 300/15000 * 100
      expect(result.totals.cpm).toBe(10) // 150/15000 * 1000
      expect(result.totals.cpc).toBe(0.5) // 150/300
      expect(result.byDate).toHaveLength(2)
    })
  })
})
