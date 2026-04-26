import { Test } from '@nestjs/testing'
import { ConflictException, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import * as argon2 from 'argon2'
import { AuthService } from './auth.service'
import { PrismaService } from '../prisma/prisma.service'

const mockPrismaClient = {
  tenant: { findUnique: jest.fn(), create: jest.fn() },
  user: { findFirst: jest.fn() },
  session: { create: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
}

const mockPrismaService = { client: mockPrismaClient, rawClient: mockPrismaClient }
const mockJwtService = { signAsync: jest.fn().mockResolvedValue('mock-token') }
const mockConfigService = { get: jest.fn().mockReturnValue('mock-secret') }

describe('AuthService', () => {
  let service: AuthService

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile()

    service = module.get(AuthService)
    jest.clearAllMocks()
    mockJwtService.signAsync.mockResolvedValue('mock-token')
  })

  describe('register', () => {
    const registerDto = {
      name: 'Igor',
      email: 'igor@test.com',
      password: 'senha123!',
      tenantName: 'MarketProAds',
      tenantSlug: 'marketproads',
    }

    it('deve criar tenant e usuário e retornar tokens', async () => {
      mockPrismaClient.tenant.findUnique.mockResolvedValue(null)
      mockPrismaClient.tenant.create.mockResolvedValue({
        id: 'tenant-1',
        users: [{ id: 'user-1', email: registerDto.email, tenantId: 'tenant-1', role: 'OWNER' }],
      })

      const result = await service.register(registerDto)

      expect(result).toHaveProperty('accessToken')
      expect(result).toHaveProperty('refreshToken')
      expect(mockPrismaClient.tenant.create).toHaveBeenCalledTimes(1)
    })

    it('deve lançar ConflictException se slug já existe', async () => {
      mockPrismaClient.tenant.findUnique.mockResolvedValue({ id: 'existing' })

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException)
    })
  })

  describe('login', () => {
    const loginDto = { email: 'igor@test.com', password: 'senha123!' }

    it('deve retornar tokens com credenciais válidas', async () => {
      const passwordHash = await argon2.hash(loginDto.password)
      mockPrismaClient.user.findFirst.mockResolvedValue({
        id: 'user-1',
        email: loginDto.email,
        passwordHash,
        tenantId: 'tenant-1',
        role: 'OWNER',
        tenant: { id: 'tenant-1' },
      })
      mockPrismaClient.session.create.mockResolvedValue({})

      const result = await service.login(loginDto)

      expect(result).toHaveProperty('accessToken')
      expect(result).toHaveProperty('refreshToken')
    })

    it('deve lançar UnauthorizedException se usuário não existe', async () => {
      mockPrismaClient.user.findFirst.mockResolvedValue(null)

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException)
    })

    it('deve lançar UnauthorizedException se senha errada', async () => {
      const passwordHash = await argon2.hash('outra-senha')
      mockPrismaClient.user.findFirst.mockResolvedValue({
        id: 'user-1',
        email: loginDto.email,
        passwordHash,
        tenantId: 'tenant-1',
        role: 'OWNER',
      })

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException)
    })
  })

  describe('refresh', () => {
    it('deve lançar UnauthorizedException se sessão não existe', async () => {
      mockPrismaClient.session.findUnique.mockResolvedValue(null)

      await expect(service.refresh('invalid-token')).rejects.toThrow(UnauthorizedException)
    })

    it('deve lançar UnauthorizedException se sessão expirou', async () => {
      mockPrismaClient.session.findUnique.mockResolvedValue({
        id: 'session-1',
        expiresAt: new Date(Date.now() - 1000),
        user: { id: 'user-1', email: 'igor@test.com', tenantId: 'tenant-1', role: 'OWNER' },
      })

      await expect(service.refresh('expired-token')).rejects.toThrow(UnauthorizedException)
    })

    it('deve rotacionar tokens com sessão válida', async () => {
      mockPrismaClient.session.findUnique.mockResolvedValue({
        id: 'session-1',
        expiresAt: new Date(Date.now() + 60000),
        user: { id: 'user-1', email: 'igor@test.com', tenantId: 'tenant-1', role: 'OWNER' },
      })
      mockPrismaClient.session.delete.mockResolvedValue({})
      mockPrismaClient.session.create.mockResolvedValue({})

      const result = await service.refresh('valid-token')

      expect(result).toHaveProperty('accessToken')
      expect(result).toHaveProperty('refreshToken')
      expect(mockPrismaClient.session.delete).toHaveBeenCalledTimes(1)
    })
  })
})
