import { PrismaClient } from './generated/client'
import { tenantGuard } from './middleware/tenant-guard'

type CreateOptions = { skipTenantGuard?: boolean }

export function createPrismaClient(options: CreateOptions = {}): PrismaClient {
  const prisma = new PrismaClient({
    log: process.env['NODE_ENV'] === 'development' ? ['warn', 'error'] : ['error'],
  })

  if (!options.skipTenantGuard) {
    prisma.$use(tenantGuard)
  }

  return prisma
}
