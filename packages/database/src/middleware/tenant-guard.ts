import type { Prisma } from '../generated/client'

const TENANT_AWARE_MODELS = ['User', 'AuditLog', 'Client'] as const
type TenantAwareModel = (typeof TENANT_AWARE_MODELS)[number]

function isTenantAware(model: string | undefined): model is TenantAwareModel {
  return TENANT_AWARE_MODELS.includes(model as TenantAwareModel)
}

/**
 * Prisma middleware that blocks any query on tenant-aware models
 * that doesn't include a tenantId filter. Prevents accidental cross-tenant data leaks.
 */
export const tenantGuard: Prisma.Middleware = async (params, next) => {
  if (!isTenantAware(params.model)) {
    return next(params)
  }

  const readOps = ['findFirst', 'findMany', 'findUnique', 'count', 'aggregate', 'groupBy']
  const updateOps = ['update', 'updateMany', 'delete', 'deleteMany']
  const writeOps = ['create', 'createMany', 'upsert']

  if (readOps.includes(params.action) || updateOps.includes(params.action)) {
    const where = params.args?.where
    if (!where?.tenantId) {
      throw new Error(
        `[tenantGuard] Query on ${params.model}.${params.action} is missing tenantId filter. ` +
          `Always scope queries by tenantId.`,
      )
    }
  }

  if (writeOps.includes(params.action)) {
    const data = params.args?.data
    if (!data?.tenantId) {
      throw new Error(
        `[tenantGuard] Write on ${params.model}.${params.action} is missing tenantId. ` +
          `Always include tenantId in write operations.`,
      )
    }
  }

  return next(params)
}
