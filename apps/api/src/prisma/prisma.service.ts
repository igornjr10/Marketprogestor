import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { createPrismaClient } from '@marketproads/database'
import type { PrismaClient } from '@marketproads/database'

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  /** Guarded client — enforces tenantId on all tenant-aware queries */
  readonly client: PrismaClient = createPrismaClient()

  /** Unguarded client — use ONLY in auth flows where tenantId is not yet known */
  readonly rawClient: PrismaClient = createPrismaClient({ skipTenantGuard: true })

  async onModuleInit(): Promise<void> {
    await Promise.all([this.client.$connect(), this.rawClient.$connect()])
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([this.client.$disconnect(), this.rawClient.$disconnect()])
  }
}
