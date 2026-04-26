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
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn().mockResolvedValue({}),
    close: jest.fn().mockResolvedValue(undefined),
  })),
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
  syncLog: { createMany: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn() },
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
  get: jest.fn((key: string) => {
    const vals: Record<string, string> = {
      META_REDIRECT_URI: 'http://localhost:3000/meta/callback',
      REDIS_URL: 'redis://localhost:6379',
    }
    return vals[key] ?? ''
  }),
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

      // dto.tokenData decrypts to 'decrypted-token' (mock), which is used as rawToken throughout
      const { encrypt } = await import('@marketproads/crypto')
      expect(encrypt).toHaveBeenCalledWith('decrypted-token')
      expect(mockMetaAdapter.createSystemUser).toHaveBeenCalledWith(
        'decrypted-token',
        'biz-123',
        'MarketProgestor System User',
      )
      expect(mockMetaAdapter.getSystemUserToken).toHaveBeenCalledWith('decrypted-token', 'sys-1')
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
    const clientWithConn = {
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
    }

    it('adiciona jobs na fila para cada conta de anúncio', async () => {
      mockPrismaClient.client.findFirst.mockResolvedValue(clientWithConn)
      mockPrismaRaw.syncLog.findFirst.mockResolvedValue(null)
      mockPrismaRaw.syncLog.createMany.mockResolvedValue({})

      await service.triggerSync('tenant-1', 'client-1')

      expect(mockPrismaRaw.syncLog.createMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.arrayContaining([expect.objectContaining({ jobType: 'STRUCTURE', status: 'PENDING' })]) }),
      )
    })

    it('lança ConflictException se sync recente existe (cooldown)', async () => {
      mockPrismaClient.client.findFirst.mockResolvedValue(clientWithConn)
      mockPrismaRaw.syncLog.findFirst.mockResolvedValue({
        id: 'log-1',
        startedAt: new Date(), // agora — dentro do cooldown
      })

      await expect(service.triggerSync('tenant-1', 'client-1')).rejects.toThrow(ConflictException)
    })

    it('permite sync se cooldown expirou (>5 min atrás)', async () => {
      mockPrismaClient.client.findFirst.mockResolvedValue(clientWithConn)
      const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000)
      mockPrismaRaw.syncLog.findFirst.mockResolvedValue({ id: 'log-1', startedAt: sixMinutesAgo })
      mockPrismaRaw.syncLog.createMany.mockResolvedValue({})

      await expect(service.triggerSync('tenant-1', 'client-1')).resolves.not.toThrow()
    })

    it('lança NotFoundException se não há conexão Meta', async () => {
      mockPrismaClient.client.findFirst.mockResolvedValue(baseClient)

      await expect(service.triggerSync('tenant-1', 'client-1')).rejects.toThrow(NotFoundException)
    })
  })

  describe('getSyncLogs', () => {
    const clientWithConn = {
      ...baseClient,
      metaConnections: [{ id: 'conn-1', status: 'ACTIVE', adAccounts: [] }],
    }

    it('retorna logs paginados com metadados corretos', async () => {
      mockPrismaClient.client.findFirst.mockResolvedValue(clientWithConn)
      const fakeLogs = [{ id: 'log-1', jobType: 'STRUCTURE', status: 'COMPLETED' }]
      mockPrismaRaw.syncLog.findMany.mockResolvedValue(fakeLogs)
      mockPrismaRaw.syncLog.count.mockResolvedValue(1)

      const result = await service.getSyncLogs('tenant-1', 'client-1', 1, 20)

      expect(result.logs).toEqual(fakeLogs)
      expect(result.pagination).toMatchObject({ page: 1, limit: 20, total: 1, pages: 1 })
    })

    it('calcula corretamente o total de páginas', async () => {
      mockPrismaClient.client.findFirst.mockResolvedValue(clientWithConn)
      mockPrismaRaw.syncLog.findMany.mockResolvedValue([])
      mockPrismaRaw.syncLog.count.mockResolvedValue(45)

      const result = await service.getSyncLogs('tenant-1', 'client-1', 1, 20)

      expect(result.pagination.pages).toBe(3)
    })

    it('lança NotFoundException se não há conexão Meta', async () => {
      mockPrismaClient.client.findFirst.mockResolvedValue(baseClient)

      await expect(service.getSyncLogs('tenant-1', 'client-1')).rejects.toThrow(NotFoundException)
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
