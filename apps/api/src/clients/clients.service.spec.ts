import { Test } from '@nestjs/testing'
import { ConflictException, UnauthorizedException, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ClientsService } from './clients.service'
import { PrismaService } from '../prisma/prisma.service'
import { MetaApiAdapter } from '../integrations/meta/meta-api.adapter'

jest.mock('@marketproads/crypto', () => ({
  encrypt: jest.fn().mockReturnValue('encrypted-token'),
  decrypt: jest.fn().mockReturnValue('decrypted-token'),
}))

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({ add: jest.fn().mockResolvedValue({}) })),
}))

const baseClient = {
  id: 'client-1',
  tenantId: 'tenant-1',
  name: 'Test Client',
  status: 'ACTIVE',
  metaConnections: [],
}

const mockPrismaClient = {
  client: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
}

const mockPrismaRaw = {
  metaConnection: { create: jest.fn(), update: jest.fn(), delete: jest.fn() },
  syncLog: { createMany: jest.fn() },
}

const mockPrismaService = { client: mockPrismaClient, rawClient: mockPrismaRaw }

const mockMetaAdapter = {
  buildOAuthUrl: jest.fn().mockReturnValue('https://facebook.com/dialog/oauth'),
  validateToken: jest.fn(),
  getAdAccounts: jest.fn(),
  getLongLivedToken: jest.fn(),
  exchangeCodeForToken: jest.fn(),
  getBusinesses: jest.fn(),
  createSystemUser: jest.fn(),
  getSystemUserToken: jest.fn(),
}

const mockConfigService = {
  get: jest.fn().mockReturnValue('http://localhost:3000/meta/callback'),
}

describe('ClientsService', () => {
  let service: ClientsService

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ClientsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: MetaApiAdapter, useValue: mockMetaAdapter },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile()

    service = module.get(ClientsService)
    jest.clearAllMocks()
    mockConfigService.get.mockReturnValue('http://localhost:3000/meta/callback')
  })

  describe('finalizeConnection', () => {
    const dto = {
      businessId: 'biz-123',
      businessName: 'Minha Empresa',
      adAccountIds: ['acc-1'],
      tokenData: 'raw-access-token',
    }

    it('criptografa o token e persiste a conexão', async () => {
      mockPrismaClient.client.findFirst.mockResolvedValue(baseClient)
      mockMetaAdapter.validateToken.mockResolvedValue({
        is_valid: true,
        scopes: ['ads_management'],
        expires_at: null,
      })
      mockMetaAdapter.getAdAccounts.mockResolvedValue([
        {
          id: 'act_1',
          account_id: 'acc-1',
          name: 'Ad Account 1',
          currency: 'BRL',
          timezone_name: 'America/Sao_Paulo',
          account_status: 1,
        },
      ])
      mockMetaAdapter.createSystemUser.mockResolvedValue({ id: 'sys-1' })
      mockMetaAdapter.getSystemUserToken.mockResolvedValue({
        access_token: 'sys-token',
        token_type: 'bearer',
      })
      mockPrismaRaw.metaConnection.create.mockResolvedValue({ id: 'conn-1', adAccounts: [] })

      await service.finalizeConnection('tenant-1', 'client-1', dto)

      const { encrypt } = await import('@marketproads/crypto')
      expect(encrypt).toHaveBeenCalledWith('raw-access-token')
      expect(mockMetaAdapter.createSystemUser).toHaveBeenCalledWith(
        'raw-access-token',
        'biz-123',
        'MarketProgestor System User',
      )
      expect(mockMetaAdapter.getSystemUserToken).toHaveBeenCalledWith('raw-access-token', 'sys-1')
      expect(mockPrismaRaw.metaConnection.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            accessTokenEncrypted: 'encrypted-token',
            systemUserId: 'sys-1',
          }),
        }),
      )
    })

    it('lança ConflictException se conexão já existe', async () => {
      mockPrismaClient.client.findFirst.mockResolvedValue({
        ...baseClient,
        metaConnections: [{ id: 'existing-conn' }],
      })

      await expect(service.finalizeConnection('tenant-1', 'client-1', dto)).rejects.toThrow(
        ConflictException,
      )
    })

    it('lança UnauthorizedException se token Meta inválido', async () => {
      mockPrismaClient.client.findFirst.mockResolvedValue(baseClient)
      mockMetaAdapter.validateToken.mockResolvedValue({ is_valid: false, scopes: [] })

      await expect(service.finalizeConnection('tenant-1', 'client-1', dto)).rejects.toThrow(
        UnauthorizedException,
      )
    })
  })

  describe('triggerSync', () => {
    it('adiciona jobs na fila para cada conta de anúncio', async () => {
      mockPrismaClient.client.findFirst.mockResolvedValue({
        ...baseClient,
        metaConnections: [
          {
            id: 'conn-1',
            businessId: 'biz-1',
            businessName: 'Empresa',
            accessTokenEncrypted: 'encrypted-token',
            scopes: [],
            status: 'ACTIVE',
            adAccounts: [{ id: 'ad-1' }, { id: 'ad-2' }],
          },
        ],
      })
      mockPrismaRaw.syncLog.createMany = jest.fn().mockResolvedValue({})

      await service.triggerSync('tenant-1', 'client-1')

      expect(mockPrismaRaw.syncLog.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.any(Array),
        }),
      )
    })
  })

  describe('checkHealth', () => {
    it('retorna status ACTIVE e usa token descriptografado', async () => {
      mockPrismaClient.client.findFirst.mockResolvedValue({
        ...baseClient,
        metaConnections: [
          { id: 'conn-1', accessTokenEncrypted: 'encrypted-token', status: 'ACTIVE' },
        ],
      })
      mockMetaAdapter.validateToken.mockResolvedValue({ is_valid: true, scopes: ['ads_management'] })
      mockPrismaRaw.metaConnection.update.mockResolvedValue({})

      const result = await service.checkHealth('tenant-1', 'client-1')

      const { decrypt } = await import('@marketproads/crypto')
      expect(decrypt).toHaveBeenCalledWith('encrypted-token')
      expect(mockMetaAdapter.validateToken).toHaveBeenCalledWith('decrypted-token')
      expect(result.status).toBe('ACTIVE')
      expect(result.isValid).toBe(true)
    })

    it('lança NotFoundException se não há conexão', async () => {
      mockPrismaClient.client.findFirst.mockResolvedValue(baseClient)

      await expect(service.checkHealth('tenant-1', 'client-1')).rejects.toThrow(NotFoundException)
    })
  })

  describe('remove', () => {
    it('faz soft delete atualizando status para DELETED', async () => {
      mockPrismaClient.client.findFirst.mockResolvedValue(baseClient)
      mockPrismaClient.client.update.mockResolvedValue({ ...baseClient, status: 'DELETED' })

      await service.remove('tenant-1', 'client-1')

      expect(mockPrismaClient.client.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'DELETED' } }),
      )
    })
  })
})
