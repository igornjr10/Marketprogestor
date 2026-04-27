-- CreateEnum
CREATE TYPE "AlertEventStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ruleJson" JSONB NOT NULL,
    "channels" JSONB NOT NULL,
    "cooldownMinutes" INTEGER NOT NULL DEFAULT 60,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_events" (
    "id" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityName" TEXT NOT NULL,
    "metricValue" DOUBLE PRECISION NOT NULL,
    "ruleSnapshot" JSONB NOT NULL,
    "status" "AlertEventStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "alert_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "alerts_tenantId_idx" ON "alerts"("tenantId");
CREATE INDEX "alerts_clientId_idx" ON "alerts"("clientId");
CREATE INDEX "alerts_isActive_idx" ON "alerts"("isActive");
CREATE INDEX "alert_events_alertId_idx" ON "alert_events"("alertId");
CREATE INDEX "alert_events_status_idx" ON "alert_events"("status");
CREATE INDEX "alert_events_triggeredAt_idx" ON "alert_events"("triggeredAt");

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "alert_events" ADD CONSTRAINT "alert_events_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "alerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
