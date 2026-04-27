import { Test } from '@nestjs/testing'
import { NotFoundException } from '@nestjs/common'
import { CreativeAnalysisService } from './creative-analysis.service'
import { PrismaService } from '../prisma/prisma.service'
import { CacheService } from '../cache/cache.service'

const makeInsights = (overrides: Partial<{
  entityId: string; date: Date; spend: number; impressions: number;
  reach: number; clicks: number; frequency: number | null
}>[] = []) =>
  overrides.map((o, i) => ({
    entityId: 'ad-1',
    date: new Date(2026, 0, i + 1),
    spend: 10,
    impressions: 1000,
    reach: 800,
    clicks: 20,
    frequency: 1.5,
    ...o,
  }))

describe('CreativeAnalysisService', () => {
  let service: CreativeAnalysisService
  let prisma: { client: { insight: jest.Mocked<any>; ad: jest.Mocked<any>; client: jest.Mocked<any> } }
  let cache: jest.Mocked<Pick<CacheService, 'withCache'>>

  beforeEach(async () => {
    prisma = {
      client: {
        insight: { findMany: jest.fn() },
        ad: { findMany: jest.fn(), findFirst: jest.fn() },
        client: { findFirst: jest.fn() },
      },
    }
    cache = { withCache: jest.fn().mockImplementation((_k, _t, fn) => fn()) }

    const module = await Test.createTestingModule({
      providers: [
        CreativeAnalysisService,
        { provide: PrismaService, useValue: prisma },
        { provide: CacheService, useValue: cache },
      ],
    }).compile()

    service = module.get(CreativeAnalysisService)
  })

  describe('detectFatigue', () => {
    it('returns SEVERE when delta > 0.40 and frequency > 3.5', () => {
      // baseline CTR = 0.05, recent CTR = 0.02 → delta = 0.6; recent freq = 4.0
      const baseline = makeInsights(Array.from({ length: 7 }, () => ({ impressions: 1000, clicks: 50, frequency: 1.0 })))
      const recent = makeInsights([
        { date: new Date(2026, 0, 8), impressions: 1000, clicks: 20, frequency: 4.0 },
        { date: new Date(2026, 0, 9), impressions: 1000, clicks: 20, frequency: 4.0 },
        { date: new Date(2026, 0, 10), impressions: 1000, clicks: 20, frequency: 4.0 },
      ])
      const result = service.detectFatigue([...baseline, ...recent])
      expect(result.level).toBe('SEVERE')
    })

    it('returns MODERATE when delta > 0.25 and frequency > 2.5', () => {
      const baseline = makeInsights(Array.from({ length: 7 }, () => ({ impressions: 1000, clicks: 40, frequency: 1.0 })))
      const recent = makeInsights([
        { date: new Date(2026, 0, 8), impressions: 1000, clicks: 28, frequency: 2.8 },
        { date: new Date(2026, 0, 9), impressions: 1000, clicks: 28, frequency: 2.8 },
        { date: new Date(2026, 0, 10), impressions: 1000, clicks: 28, frequency: 2.8 },
      ])
      const result = service.detectFatigue([...baseline, ...recent])
      expect(result.level).toBe('MODERATE')
    })

    it('returns NONE when delta is low', () => {
      const rows = makeInsights(Array.from({ length: 10 }, () => ({ impressions: 1000, clicks: 30, frequency: 1.0 })))
      const result = service.detectFatigue(rows)
      expect(result.level).toBe('NONE')
    })

    it('returns NONE when baseline CTR is 0 (no impressions)', () => {
      const rows = makeInsights(Array.from({ length: 10 }, () => ({ impressions: 0, clicks: 0, frequency: 0 })))
      const result = service.detectFatigue(rows)
      expect(result.level).toBe('NONE')
      expect(result.delta).toBe(0)
    })

    it('returns NONE when there are fewer than 3 recent records', () => {
      const rows = makeInsights([
        { impressions: 1000, clicks: 50, frequency: 1.0 },
        { date: new Date(2026, 0, 2), impressions: 1000, clicks: 10, frequency: 4.5 },
      ])
      const result = service.detectFatigue(rows)
      // Only 2 rows total, baseline is first 7 (both) and recent is last 3 (same 2)
      expect(result.level).toBe('NONE')
    })
  })

  describe('getCreativesGallery', () => {
    it('throws NotFoundException for unknown tenant/client', async () => {
      prisma.client.client.findFirst.mockResolvedValue(null)
      await expect(
        service.getCreativesGallery('bad-tenant', 'client-1', { period: 30, sort: 'spend:desc', page: 1, limit: 20 }),
      ).rejects.toThrow(NotFoundException)
    })

    it('returns empty gallery when no ads exist', async () => {
      prisma.client.client.findFirst.mockResolvedValue({ id: 'client-1' })
      prisma.client.ad.findMany.mockResolvedValue([])
      const result = await service.getCreativesGallery('tenant-1', 'client-1', { period: 30, sort: 'spend:desc', page: 1, limit: 20 })
      expect(result.creatives).toHaveLength(0)
      expect(result.pagination.total).toBe(0)
    })

    it('filters by fatigueFilter=SEVERE', async () => {
      prisma.client.client.findFirst.mockResolvedValue({ id: 'client-1' })
      prisma.client.ad.findMany.mockResolvedValue([
        { id: 'ad-db-1', metaAdId: 'meta-1', name: 'Ad 1', status: 'ACTIVE', creativeData: {}, adSet: { id: 'as-1', campaign: { id: 'c-1', name: 'C1', adAccount: { clientId: 'client-1' } } } },
        { id: 'ad-db-2', metaAdId: 'meta-2', name: 'Ad 2', status: 'ACTIVE', creativeData: {}, adSet: { id: 'as-1', campaign: { id: 'c-1', name: 'C1', adAccount: { clientId: 'client-1' } } } },
      ])
      // meta-1 has SEVERE fatigue: high delta, high freq
      const baseRows1 = Array.from({ length: 7 }, (_, i) => ({ entityId: 'meta-1', date: new Date(2026, 0, i + 1), spend: 10, impressions: 1000, clicks: 50, reach: 800, frequency: 1.0 }))
      const recentRows1 = [
        { entityId: 'meta-1', date: new Date(2026, 0, 8), spend: 10, impressions: 1000, clicks: 10, reach: 800, frequency: 4.5 },
        { entityId: 'meta-1', date: new Date(2026, 0, 9), spend: 10, impressions: 1000, clicks: 10, reach: 800, frequency: 4.5 },
        { entityId: 'meta-1', date: new Date(2026, 0, 10), spend: 10, impressions: 1000, clicks: 10, reach: 800, frequency: 4.5 },
      ]
      // meta-2 has no data → NONE
      prisma.client.insight.findMany.mockResolvedValue([...baseRows1, ...recentRows1])

      const result = await service.getCreativesGallery('tenant-1', 'client-1', {
        period: 30, sort: 'spend:desc', fatigueFilter: 'SEVERE', page: 1, limit: 20,
      })
      expect(result.creatives).toHaveLength(1)
      expect(result.creatives[0].adId).toBe('meta-1')
      expect(result.creatives[0].fatigue.level).toBe('SEVERE')
    })

    it('sorts by spend descending', async () => {
      prisma.client.client.findFirst.mockResolvedValue({ id: 'client-1' })
      prisma.client.ad.findMany.mockResolvedValue([
        { id: 'ad-db-1', metaAdId: 'meta-1', name: 'Ad 1', status: 'ACTIVE', creativeData: {}, adSet: { id: 'as-1', campaign: { id: 'c-1', name: 'C1', adAccount: { clientId: 'client-1' } } } },
        { id: 'ad-db-2', metaAdId: 'meta-2', name: 'Ad 2', status: 'ACTIVE', creativeData: {}, adSet: { id: 'as-1', campaign: { id: 'c-1', name: 'C1', adAccount: { clientId: 'client-1' } } } },
      ])
      prisma.client.insight.findMany.mockResolvedValue([
        { entityId: 'meta-1', date: new Date(), spend: 50, impressions: 5000, clicks: 100, reach: 4000, frequency: 1.2 },
        { entityId: 'meta-2', date: new Date(), spend: 200, impressions: 10000, clicks: 200, reach: 8000, frequency: 1.5 },
      ])
      const result = await service.getCreativesGallery('tenant-1', 'client-1', {
        period: 30, sort: 'spend:desc', page: 1, limit: 20,
      })
      expect(result.creatives[0].adId).toBe('meta-2')
      expect(result.creatives[1].adId).toBe('meta-1')
    })
  })

  it('calculates CTR correctly (clicks / impressions * 100)', () => {
    const rows = makeInsights([{ impressions: 500, clicks: 25, frequency: 1.0 }])
    const result = service.detectFatigue(rows)
    expect(result.baselineCtr).toBe(5) // 25/500 * 100 = 5%
  })
})
