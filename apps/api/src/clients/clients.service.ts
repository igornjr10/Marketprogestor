import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Queue } from 'bullmq'
import { encrypt, decrypt } from '@marketproads/crypto'
import { PrismaService } from '../prisma/prisma.service'
import { MetaApiAdapter } from '../integrations/meta/meta-api.adapter'
import type { CreateClientDto } from './dto/create-client.dto'
import type { FinalizeMetaDto } from './dto/finalize-meta.dto'
import type { Env } from '../config/env.schema'

@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly meta: MetaApiAdapter,
    private readonly config: ConfigService<Env>,
  ) {}

  async findAll(tenantId: string) {
    const clients = await this.prisma.client.client.findMany({
      where: { tenantId, status: { not: 'DELETED' } },
      include: {
        metaConnections: {
          select: {
            id: true,
            businessId: true,
            businessName: true,
            status: true,
            lastValidatedAt: true,
            _count: { select: { adAccounts: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return clients.map((c) => ({
      ...c,
      metaConnection: c.metaConnections[0]
        ? {
            ...c.metaConnections[0],
            adAccountCount: c.metaConnections[0]._count.adAccounts,
          }
        : null,
      metaConnections: undefined,
    }))
  }

  async findOne(tenantId: string, id: string) {
    const client = await this.prisma.client.client.findFirst({
      where: { id, tenantId, status: { not: 'DELETED' } },
      include: {
        metaConnections: {
          include: { adAccounts: true },
        },
      },
    })
    if (!client) throw new NotFoundException('Client não encontrado')
    return client
  }

  async create(tenantId: string, dto: CreateClientDto) {
    return this.prisma.client.client.create({
      data: { name: dto.name, tenantId },
    })
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id)
    return this.prisma.client.client.update({
      where: { id },
      data: { status: 'DELETED' },
    })
  }

  buildConnectUrl(clientId: string): string {
    const redirectUri = this.config.get('META_REDIRECT_URI') ?? ''
    const state = Buffer.from(JSON.stringify({ clientId })).toString('base64url')
    return this.meta.buildOAuthUrl(redirectUri, state)
  }

  async handleCallback(tenantId: string, clientId: string, code: string) {
    await this.findOne(tenantId, clientId)

    const redirectUri = this.config.get('META_REDIRECT_URI') ?? ''
    const shortToken = await this.meta.exchangeCodeForToken(code, redirectUri)
    const longToken = await this.meta.getLongLivedToken(shortToken.access_token)
    const businesses = await this.meta.getBusinesses(longToken.access_token)

    const adAccountsByBusiness: Record<string, Awaited<ReturnType<MetaApiAdapter['getAdAccounts']>>> = {}
    for (const biz of businesses) {
      adAccountsByBusiness[biz.id] = await this.meta.getAdAccounts(longToken.access_token, biz.id)
    }

    return {
      tokenData: encrypt(longToken.access_token),
      businesses,
      adAccounts: adAccountsByBusiness,
    }
  }

  async finalizeConnection(tenantId: string, clientId: string, dto: FinalizeMetaDto) {
    const client = await this.findOne(tenantId, clientId)

    if (client.metaConnections.length > 0) {
      throw new ConflictException('Client já possui uma conexão Meta ativa')
    }

    const rawToken = decrypt(dto.tokenData)

    const tokenInfo = await this.meta.validateToken(rawToken)
    if (!tokenInfo.is_valid) throw new UnauthorizedException('Token Meta inválido')

    const systemUser = await this.meta.createSystemUser(
      rawToken,
      dto.businessId,
      'MarketProgestor System User',
    )

    await this.meta.getSystemUserToken(rawToken, systemUser.id)

    const encryptedToken = encrypt(rawToken)

    const adAccounts = await this.meta.getAdAccounts(rawToken, dto.businessId)
    const selectedAccounts = adAccounts.filter((a) =>
      dto.adAccountIds.includes(a.account_id),
    )

    const connection = await this.prisma.rawClient.metaConnection.create({
      data: {
        clientId,
        businessId: dto.businessId,
        businessName: dto.businessName,
        systemUserId: systemUser.id,
        accessTokenEncrypted: encryptedToken,
        scopes: tokenInfo.scopes ?? [],
        status: 'ACTIVE',
        lastValidatedAt: new Date(),
        expiresAt: tokenInfo.expires_at
          ? new Date(tokenInfo.expires_at * 1000)
          : null,
        adAccounts: {
          create: selectedAccounts.map((a) => ({
            clientId,
            accountId: a.account_id,
            name: a.name,
            currency: a.currency,
            timezone: a.timezone_name,
            status: String(a.account_status),
          })),
        },
      },
      include: { adAccounts: true },
    })

    return connection
  }

  async checkHealth(tenantId: string, clientId: string) {
    const client = await this.findOne(tenantId, clientId)
    const connection = client.metaConnections[0]
    if (!connection) throw new NotFoundException('Nenhuma conexão Meta encontrada')

    const token = decrypt(connection.accessTokenEncrypted)
    const tokenInfo = await this.meta.validateToken(token)

    const status = tokenInfo.is_valid ? 'ACTIVE' : 'EXPIRED'

    await this.prisma.rawClient.metaConnection.update({
      where: { id: connection.id },
      data: { status, lastValidatedAt: new Date() },
    })

    return { status, isValid: tokenInfo.is_valid, scopes: tokenInfo.scopes }
  }

  async disconnect(tenantId: string, clientId: string) {
    const client = await this.findOne(tenantId, clientId)
    const connection = client.metaConnections[0]
    if (!connection) throw new NotFoundException('Nenhuma conexão Meta encontrada')

    await this.prisma.rawClient.metaConnection.delete({ where: { id: connection.id } })
  }

  async getSyncStatus(tenantId: string, clientId: string) {
    const client = await this.findOne(tenantId, clientId)
    const connection = client.metaConnections[0]
    if (!connection) throw new NotFoundException('Nenhuma conexão Meta encontrada')

    const lastSync = await this.prisma.rawClient.syncLog.findFirst({
      where: { clientId },
      orderBy: { finishedAt: 'desc' },
    })

    const nextScheduled = this.calculateNextSync()

    return {
      lastSync: lastSync?.finishedAt,
      nextScheduled,
      status: lastSync?.status ?? 'NEVER',
    }
  }

  async triggerSync(tenantId: string, clientId: string) {
    const client = await this.findOne(tenantId, clientId)
    const connection = client.metaConnections[0]
    if (!connection) throw new NotFoundException('Nenhuma conexão Meta encontrada')

    // Check cooldown (5 minutes)
    const lastTrigger = await this.prisma.rawClient.syncLog.findFirst({
      where: { clientId, jobType: 'STRUCTURE' },
      orderBy: { startedAt: 'desc' },
    })

    if (lastTrigger && lastTrigger.startedAt) {
      const cooldownMs = 5 * 60 * 1000
      const timeSinceLast = Date.now() - lastTrigger.startedAt.getTime()
      if (timeSinceLast < cooldownMs) {
        throw new ConflictException('Sync em cooldown, aguarde 5 minutos')
      }
    }

    const redisUrl = new URL(this.config.get('REDIS_URL') ?? 'redis://localhost:6379')
    const queue = new Queue('meta-sync', {
      connection: { host: redisUrl.hostname, port: parseInt(redisUrl.port || '6379', 10) },
    })

    try {
      const accountJobs = connection.adAccounts.map((account) =>
        queue.add(
          'sync-structure',
          { tenantId, adAccountId: account.id },
          {
            attempts: 5,
            backoff: { type: 'exponential', delay: 2000 },
            removeOnComplete: true,
            removeOnFail: false,
            priority: 1,
          },
        ),
      )

      await Promise.all(accountJobs)

      await this.prisma.rawClient.syncLog.createMany({
        data: connection.adAccounts.map(() => ({
          clientId,
          jobType: 'STRUCTURE' as const,
          status: 'PENDING' as const,
          startedAt: new Date(),
        })),
      })
    } finally {
      await queue.close()
    }
  }

  async getSyncLogs(tenantId: string, clientId: string, page = 1, limit = 20) {
    const client = await this.findOne(tenantId, clientId)
    const connection = client.metaConnections[0]
    if (!connection) throw new NotFoundException('Nenhuma conexão Meta encontrada')

    const [logs, total] = await Promise.all([
      this.prisma.rawClient.syncLog.findMany({
        where: { clientId },
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.rawClient.syncLog.count({ where: { clientId } }),
    ])

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    }
  }

  private calculateNextSync(): Date {
    const now = new Date()
    const nextHour = new Date(now)
    nextHour.setHours(now.getHours() + 1, 0, 0, 0)
    return nextHour
  }
}
