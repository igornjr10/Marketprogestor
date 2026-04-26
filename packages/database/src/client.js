"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPrismaClient = createPrismaClient;
const client_1 = require("./generated/client");
const tenant_guard_1 = require("./middleware/tenant-guard");
function createPrismaClient(options = {}) {
    const prisma = new client_1.PrismaClient({
        log: process.env['NODE_ENV'] === 'development' ? ['warn', 'error'] : ['error'],
    });
    if (!options.skipTenantGuard) {
        prisma.$use(tenant_guard_1.tenantGuard);
    }
    return prisma;
}
