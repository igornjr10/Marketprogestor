import { Test } from '@nestjs/testing'
import { NotFoundException } from '@nestjs/common'
import { MetricsService } from './metrics.service'
import { PrismaService } from '../prisma/prisma.service'
import { CacheService } from '../cache/cache.service'

const mockPrismaClient = {
  client: {
    findFirst: jest.fn(),
  },
  metaAdAccount: {
    findMany: jest.fn(),
  },
  campaign: {
    findMany: jest.fn(),
  },
  insight: {
    findMany: jest.fn(),
  },
}

const mockPrismaService = { client: mockPrismaClient }

// CacheService que passa direto para fn() (sem cache real)
const mockCacheService = {
  withCache: jest.fn().mockImplementation((_key: string, _ttl: number, fn: () => unknown) => fn()),
}

const baseClient = { id: 'client-1', tenantId: 'tenant-1', status: 'ACTIVE' }

describe('MetricsService', () => {
  let service: MetricsService

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        MetricsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CacheService, useValue: mockCacheService },
      ],
    }).compile()

    service = module.get(MetricsService)
    jest.clearAllMocks()
    mockCacheService.withCache.mockImplementation((_key: string, _ttl: number, fn: () => unknown) => fn())
  })

  describe('getOverview', () => {
    it('lança NotFoundException se client não pertence ao tenant', async () => {
      mockPrismaClient.client.findFirst.mockResolvedValue(null)

      await expect(service.getOverview('wrong-tenant', 'client-1', 7, false)).rejects.toThrow(NotFoundException)
    })

    it('retorna zeros quando não há campanhas', async () => {
      mockPrismaClient.client.findFirst.mockResolvedValue(baseClient)
      mockPrismaClient.metaAdAccount.findMany.mockResolvedValue([])
      mockPrismaClient.campaign.findMany.mockResolvedValue([])

      const result = await service.getOverview('tenant-1', 'client-1', 7, false)

      expect(result.current.spend).toBe(0)
      expect(result.current.ctr).toBe(0)
      expect(result.previous).toBeNull()
    })

    it('calcula CTR, CPM e CPC corretamente', async () => {
      mockPrismaClient.client.findFirst.mockResolvedValue(baseClient)
      mockPrismaClient.metaAdAccount.findMany.mockResolvedValue([{ id: 'acc-1' }])
      mockPrismaClient.campaign.findMany.mockResolvedValue([{ metaCampaignId: 'meta-1' }])
      mockPrismaClient.insight.findMany.mockResolvedValue([
        { spend: 100, impressions: 10000, reach: 8000, clicks: 200, date: new Date() },
      ])

      const result = await service.getOverview('tenant-1', 'client-1', 7, false)

      // CTR = 200/10000 * 100 = 2%
      expect(result.current.ctr).toBe(2)
      // CPM = 100/10000 * 1000 = 10
      expect(result.current.cpm).toBe(10)
      // CPC = 100/200 = 0.5
      expect(result.current.cpc).toBe(0.5)
      expect(result.current.spend).toBe(100)
    })

    it('calcula deltas corretamente com compare=true', async () => {
      mockPrismaClient.client.findFirst.mockResolvedValue(baseClient)
      mockPrismaClient.metaAdAccount.findMany.mockResolvedValue([{ id: 'acc-1' }])
      mockPrismaClient.campaign.findMany.mockResolvedValue([{ metaCampaignId: 'meta-1' }])

      // Primeira chamada = período atual (100 spend), segunda = período anterior (80 spend)
      mockPrismaClient.insight.findMany
        .mockResolvedValueOnce([{ spend: 100, impressions: 10000, reach: 8000, clicks: 200, date: new Date() }])
        .mockResolvedValueOnce([{ spend: 80, impressions: 8000, reach: 6000, clicks: 160, date: new Date() }])

      const result = await service.getOverview('tenant-1', 'client-1', 7, true)

      expect(result.previous).not.toBeNull()
      expect(result.deltas).not.toBeNull()
      // delta spend = (100 - 80) / 80 * 100 = 25%
      expect(result.deltas!['spend']).toBe(25)
    })

    it('usa cache: withCache chamado com a chave correta', async () => {
      mockPrismaClient.client.findFirst.mockResolvedValue(baseClient)
      mockPrismaClient.metaAdAccount.findMany.mockResolvedValue([])
      mockPrismaClient.campaign.findMany.mockResolvedValue([])

      await service.getOverview('tenant-1', 'client-1', 30, false)

      expect(mockCacheService.withCache).toHaveBeenCalledWith(
        'metrics:v1:overview:client-1:30:false',
        3600,
        expect.any(Function),
      )
    })
  })

  describe('getTimeSeries', () => {
    it('retorna array vazio quando não há campanhas', async () => {
      mockPrismaClient.client.findFirst.mockResolvedValue(baseClient)
      mockPrismaClient.metaAdAccount.findMany.mockResolvedValue([])
      mockPrismaClient.campaign.findMany.mockResolvedValue([])

      const result = await service.getTimeSeries('tenant-1', 'client-1', 7, 'day', ['spend'])

      expect(result).toEqual([])
    })

    it('agrupa corretamente por dia e calcula derivados', async () => {
      mockPrismaClient.client.findFirst.mockResolvedValue(baseClient)
      mockPrismaClient.metaAdAccount.findMany.mockResolvedValue([{ id: 'acc-1' }])
      mockPrismaClient.campaign.findMany.mockResolvedValue([{ metaCampaignId: 'meta-1' }])

      const day1 = new Date('2025-01-01')
      const day2 = new Date('2025-01-02')
      mockPrismaClient.insight.findMany.mockResolvedValue([
        { spend: 50, impressions: 5000, reach: 4000, clicks: 100, date: day1 },
        { spend: 50, impressions: 5000, reach: 4000, clicks: 100, date: day1 },
        { spend: 100, impressions: 10000, reach: 8000, clicks: 200, date: day2 },
      ])

      const result = await service.getTimeSeries('tenant-1', 'client-1', 7, 'day', ['spend', 'clicks'])

      expect(result).toHaveLength(2)
      // day1: soma das duas linhas
      expect(result[0].spend).toBe(100)
      expect(result[0].clicks).toBe(200)
      // CTR dia1 = 200/10000*100 = 2%
      expect(result[0].ctr).toBe(2)
    })
  })

  describe('getCampaignMetricsPage', () => {
    it('ordena campanhas por spend desc', async () => {
      mockPrismaClient.client.findFirst.mockResolvedValue(baseClient)
      mockPrismaClient.metaAdAccount.findMany.mockResolvedValue([{ id: 'acc-1' }])
      mockPrismaClient.campaign.findMany.mockResolvedValue([
        { id: 'c1', metaCampaignId: 'm1', name: 'C1', status: 'ACTIVE', adAccountId: 'acc-1', objective: 'REACH', dailyBudget: null, lifetimeBudget: null, startTime: new Date(), stopTime: null, createdTime: new Date(), updatedTime: new Date(), lastSyncedAt: null },
        { id: 'c2', metaCampaignId: 'm2', name: 'C2', status: 'ACTIVE', adAccountId: 'acc-1', objective: 'REACH', dailyBudget: null, lifetimeBudget: null, startTime: new Date(), stopTime: null, createdTime: new Date(), updatedTime: new Date(), lastSyncedAt: null },
      ])
      mockPrismaClient.insight.findMany.mockResolvedValue([
        { entityId: 'm1', spend: 50, impressions: 5000, reach: 4000, clicks: 100 },
        { entityId: 'm2', spend: 200, impressions: 20000, reach: 16000, clicks: 400 },
      ])

      const result = await service.getCampaignMetricsPage('tenant-1', 'client-1', {
        period: 7, sortBy: 'spend', sortDir: 'desc', page: 1, limit: 20,
      })

      expect(result.campaigns[0].name).toBe('C2')
      expect(result.campaigns[0].metrics.spend).toBe(200)
      expect(result.campaigns[1].name).toBe('C1')
    })

    it('retorna paginação correta', async () => {
      mockPrismaClient.client.findFirst.mockResolvedValue(baseClient)
      mockPrismaClient.metaAdAccount.findMany.mockResolvedValue([{ id: 'acc-1' }])
      const campaigns = Array.from({ length: 5 }, (_, i) => ({
        id: `c${i}`, metaCampaignId: `m${i}`, name: `C${i}`, status: 'ACTIVE', adAccountId: 'acc-1',
        objective: 'REACH', dailyBudget: null, lifetimeBudget: null, startTime: new Date(),
        stopTime: null, createdTime: new Date(), updatedTime: new Date(), lastSyncedAt: null,
      }))
      mockPrismaClient.campaign.findMany.mockResolvedValue(campaigns)
      mockPrismaClient.insight.findMany.mockResolvedValue([])

      const result = await service.getCampaignMetricsPage('tenant-1', 'client-1', {
        period: 7, page: 1, limit: 2,
      })

      expect(result.pagination.total).toBe(5)
      expect(result.pagination.pages).toBe(3)
      expect(result.campaigns).toHaveLength(2)
    })
  })
})
