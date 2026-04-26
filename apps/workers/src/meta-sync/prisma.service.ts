import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { createPrismaClient } from '@marketproads/database'
import type { PrismaClient } from '@marketproads/database'

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  public readonly client: PrismaClient = createPrismaClient()

  async onModuleInit(): Promise<void> {
    await this.client.$connect()
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect()
  }
}
