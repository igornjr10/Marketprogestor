"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tenantGuard = exports.createPrismaClient = exports.PrismaClient = void 0;
var client_1 = require("./generated/client");
Object.defineProperty(exports, "PrismaClient", { enumerable: true, get: function () { return client_1.PrismaClient; } });
var client_2 = require("./client");
Object.defineProperty(exports, "createPrismaClient", { enumerable: true, get: function () { return client_2.createPrismaClient; } });
var tenant_guard_1 = require("./middleware/tenant-guard");
Object.defineProperty(exports, "tenantGuard", { enumerable: true, get: function () { return tenant_guard_1.tenantGuard; } });
