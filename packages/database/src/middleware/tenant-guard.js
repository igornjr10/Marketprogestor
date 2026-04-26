"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tenantGuard = void 0;
const TENANT_AWARE_MODELS = ['User', 'AuditLog', 'Client'];
function isTenantAware(model) {
    return TENANT_AWARE_MODELS.includes(model);
}
/**
 * Prisma middleware that blocks any query on tenant-aware models
 * that doesn't include a tenantId filter. Prevents accidental cross-tenant data leaks.
 */
const tenantGuard = async (params, next) => {
    if (!isTenantAware(params.model)) {
        return next(params);
    }
    const readOps = ['findFirst', 'findMany', 'findUnique', 'count', 'aggregate', 'groupBy'];
    const updateOps = ['update', 'updateMany', 'delete', 'deleteMany'];
    const writeOps = ['create', 'createMany', 'upsert'];
    if (readOps.includes(params.action) || updateOps.includes(params.action)) {
        const where = params.args?.where;
        if (!where?.tenantId) {
            throw new Error(`[tenantGuard] Query on ${params.model}.${params.action} is missing tenantId filter. ` +
                `Always scope queries by tenantId.`);
        }
    }
    if (writeOps.includes(params.action)) {
        const data = params.args?.data;
        if (!data?.tenantId) {
            throw new Error(`[tenantGuard] Write on ${params.model}.${params.action} is missing tenantId. ` +
                `Always include tenantId in write operations.`);
        }
    }
    return next(params);
};
exports.tenantGuard = tenantGuard;
