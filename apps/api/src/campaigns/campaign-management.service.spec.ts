import { Test, TestingModule } from '@nestjs/testing'
import { BadRequestException, ConflictException } from '@nestjs/common'
import { CampaignManagementService } from './campaign-management.service'
import { PrismaService } from '../prisma/prisma.service'
import { MetaApiAdapter } from '../integrations/meta/meta-api.adapter'
import { CacheService } from '../cache/cache.service'

jest.mock('@marketproads/crypto', () => ({
  decrypt: jest.fn().mockReturnValue('access-token'),
  encrypt: jest.fn().mockReturnValue('encrypted'),
}))

const makeCampaign = (overrides: Record<string, unknown> = {}) => ({
  id: 'camp-1',
  metaCampaignId: 'meta-camp-1',
  adAccountId: 'account-1',
  name: 'Test Campaign',
  objective: 'TRAFFIC',
  status: 'ACTIVE',
  dailyBudget: 1000,
  lifetimeBudget: null,
  startTime: new Date(),
  createdTime: new Date(),
  updatedTime: new Date(),
  adAccount: {
    client: {
      metaConnections: [{ accessTokenEncrypted: 'encrypted-token' }],
    },
  },
  ...overrides,
})

describe('CampaignManagementService', () => {
  let service: CampaignManagementService
  let prisma: jest.Mocked<PrismaService>
  let meta: jest.Mocked<MetaApiAdapter>
  let cache: jest.Mocked<CacheService>

  beforeEach(async () => {
    const mockPrismaClient = {
      campaign: {
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
      adSet: {
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
      ad: {
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ tenantId: 'tenant-1' }),
      },
    }

    const mockPrismaRawClient = {
      auditLog: { create: jest.fn() },
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CampaignManagementService,
        {
          provide: PrismaService,
          useValue: {
            client: mockPrismaClient,
            rawClient: mockPrismaRawClient,
          },
        },
        {
          provide: MetaApiAdapter,
          useValue: {
            updateEntityStatus: jest.fn().mockResolvedValue(undefined),
            updateEntityBudget: jest.fn().mockResolvedValue(undefined),
            duplicateCampaign: jest.fn().mockResolvedValue({ id: 'meta-new-camp' }),
            duplicateAdSet: jest.fn().mockResolvedValue({ id: 'meta-new-adset' }),
            duplicateAd: jest.fn().mockResolvedValue({ id: 'meta-new-ad' }),
          },
        },
        {
          provide: CacheService,
          useValue: {
            invalidatePattern: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile()

    service = module.get(CampaignManagementService)
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>
    meta = module.get(MetaApiAdapter) as jest.Mocked<MetaApiAdapter>
    cache = module.get(CacheService) as jest.Mocked<CacheService>
  })

  describe('toggleStatus', () => {
    it('transitions ACTIVE → PAUSED successfully', async () => {
      const campaign = makeCampaign({ status: 'ACTIVE' })
      ;(prisma.client.campaign.findUnique as jest.Mock).mockResolvedValue(campaign)
      ;(prisma.client.campaign.update as jest.Mock).mockResolvedValue({ ...campaign, status: 'PAUSED' })

      const result = await service.toggleStatus({
        entityType: 'CAMPAIGN',
        entityId: 'camp-1',
        newStatus: 'PAUSED',
        userId: 'user-1',
      })

      expect(meta.updateEntityStatus).toHaveBeenCalledWith('CAMPAIGN', 'meta-camp-1', 'PAUSED', 'access-token')
      expect(result.status).toBe('PAUSED')
    })

    it('throws BadRequestException for invalid DELETED → ACTIVE transition', async () => {
      const campaign = makeCampaign({ status: 'DELETED' })
      ;(prisma.client.campaign.findUnique as jest.Mock).mockResolvedValue(campaign)

      await expect(
        service.toggleStatus({ entityType: 'CAMPAIGN', entityId: 'camp-1', newStatus: 'ACTIVE', userId: 'user-1' }),
      ).rejects.toThrow(BadRequestException)
    })

    it('throws BadRequestException for PAUSED → PAUSED (no-op) transition', async () => {
      const campaign = makeCampaign({ status: 'PAUSED' })
      ;(prisma.client.campaign.findUnique as jest.Mock).mockResolvedValue(campaign)

      await expect(
        service.toggleStatus({ entityType: 'CAMPAIGN', entityId: 'camp-1', newStatus: 'PAUSED', userId: 'user-1' }),
      ).rejects.toThrow(BadRequestException)
    })
  })

  describe('updateBudget', () => {
    it('throws BadRequestException when value is 0', async () => {
      await expect(
        service.updateBudget({ entityType: 'CAMPAIGN', entityId: 'camp-1', budgetType: 'DAILY', value: 0, userId: 'u1' }),
      ).rejects.toThrow(BadRequestException)
    })

    it('throws BadRequestException when value is negative', async () => {
      await expect(
        service.updateBudget({ entityType: 'CAMPAIGN', entityId: 'camp-1', budgetType: 'DAILY', value: -100, userId: 'u1' }),
      ).rejects.toThrow(BadRequestException)
    })

    it('throws ConflictException when change exceeds 50%', async () => {
      const campaign = makeCampaign({ dailyBudget: 1000 })
      ;(prisma.client.campaign.findUnique as jest.Mock).mockResolvedValue(campaign)

      await expect(
        service.updateBudget({ entityType: 'CAMPAIGN', entityId: 'camp-1', budgetType: 'DAILY', value: 2000, userId: 'u1' }),
      ).rejects.toThrow(ConflictException)
    })

    it('updates budget when change is within 50%', async () => {
      const campaign = makeCampaign({ dailyBudget: 1000 })
      ;(prisma.client.campaign.findUnique as jest.Mock).mockResolvedValue(campaign)
      ;(prisma.client.campaign.update as jest.Mock).mockResolvedValue({ ...campaign, dailyBudget: 1400 })

      const result = await service.updateBudget({
        entityType: 'CAMPAIGN',
        entityId: 'camp-1',
        budgetType: 'DAILY',
        value: 1400,
        userId: 'u1',
      })

      expect(meta.updateEntityBudget).toHaveBeenCalled()
      expect(result.dailyBudget).toBe(1400)
    })
  })

  describe('dryRun', () => {
    it('detects BUDGET_SIGNIFICANT_CHANGE with requiresConfirmation=true', async () => {
      ;(prisma.client.campaign.findUnique as jest.Mock).mockResolvedValue(makeCampaign({ dailyBudget: 1000 }))

      const result = await service.dryRun('CAMPAIGN', 'camp-1', { dailyBudget: 2000 })

      expect(result.impacts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'BUDGET_SIGNIFICANT_CHANGE', requiresConfirmation: true }),
        ]),
      )
    })

    it('detects STATUS_CHANGE with requiresConfirmation=true when pausing', async () => {
      ;(prisma.client.campaign.findUnique as jest.Mock).mockResolvedValue(makeCampaign({ status: 'ACTIVE' }))

      const result = await service.dryRun('CAMPAIGN', 'camp-1', { status: 'PAUSED' })

      expect(result.impacts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'STATUS_CHANGE', requiresConfirmation: true }),
        ]),
      )
    })
  })

  describe('duplicateCampaign', () => {
    it('creates a new campaign with status PAUSED', async () => {
      const campaign = makeCampaign()
      ;(prisma.client.campaign.findUnique as jest.Mock).mockResolvedValue(campaign)
      ;(prisma.client.campaign.create as jest.Mock).mockResolvedValue({ ...campaign, id: 'camp-new', status: 'PAUSED' })
      ;(prisma.client.adSet.findMany as jest.Mock).mockResolvedValue([])

      const result = await service.duplicateCampaign({
        campaignId: 'camp-1',
        options: { name: 'Copy', includeCreatives: false },
        userId: 'u1',
      })

      expect(prisma.client.campaign.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'PAUSED' }) }),
      )
      expect(result.status).toBe('PAUSED')
    })
  })
})
