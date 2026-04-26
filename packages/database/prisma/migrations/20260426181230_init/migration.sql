-- CreateEnum
CREATE TYPE "InsightEntityType" AS ENUM ('CAMPAIGN', 'ADSET', 'AD');

-- CreateEnum
CREATE TYPE "SyncJobType" AS ENUM ('STRUCTURE', 'INSIGHTS_FRESH', 'INSIGHTS_HISTORICAL', 'CREATIVES');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "adAccountId" TEXT NOT NULL,
    "metaCampaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "dailyBudget" DOUBLE PRECISION,
    "lifetimeBudget" DOUBLE PRECISION,
    "startTime" TIMESTAMP(3) NOT NULL,
    "stopTime" TIMESTAMP(3),
    "createdTime" TIMESTAMP(3) NOT NULL,
    "updatedTime" TIMESTAMP(3) NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_sets" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "metaAdSetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "dailyBudget" DOUBLE PRECISION,
    "lifetimeBudget" DOUBLE PRECISION,
    "targeting" JSONB NOT NULL,
    "optimizationGoal" TEXT NOT NULL,
    "billingEvent" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "createdTime" TIMESTAMP(3) NOT NULL,
    "updatedTime" TIMESTAMP(3) NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),

    CONSTRAINT "ad_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ads" (
    "id" TEXT NOT NULL,
    "adSetId" TEXT NOT NULL,
    "metaAdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "creativeId" TEXT NOT NULL,
    "creativeData" JSONB NOT NULL,
    "createdTime" TIMESTAMP(3) NOT NULL,
    "updatedTime" TIMESTAMP(3) NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),

    CONSTRAINT "ads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insights" (
    "id" TEXT NOT NULL,
    "entityType" "InsightEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "spend" DOUBLE PRECISION NOT NULL,
    "impressions" INTEGER NOT NULL,
    "reach" INTEGER NOT NULL,
    "clicks" INTEGER NOT NULL,
    "conversions" JSONB NOT NULL,
    "videoMetrics" JSONB NOT NULL,
    "breakdowns" JSONB,
    "raw" JSONB NOT NULL,

    CONSTRAINT "insights_pkey" PRIMARY KEY ("id", "date")
) PARTITION BY RANGE ("date");

-- CreateTable
CREATE TABLE "sync_logs" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "jobType" "SyncJobType" NOT NULL,
    "status" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "itemsProcessed" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "durationMs" INTEGER,

    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "campaigns_metaCampaignId_key" ON "campaigns"("metaCampaignId");

-- CreateIndex
CREATE INDEX "campaigns_adAccountId_idx" ON "campaigns"("adAccountId");

-- CreateIndex
CREATE INDEX "campaigns_metaCampaignId_idx" ON "campaigns"("metaCampaignId");

-- CreateIndex
CREATE UNIQUE INDEX "ad_sets_metaAdSetId_key" ON "ad_sets"("metaAdSetId");

-- CreateIndex
CREATE INDEX "ad_sets_campaignId_idx" ON "ad_sets"("campaignId");

-- CreateIndex
CREATE INDEX "ad_sets_metaAdSetId_idx" ON "ad_sets"("metaAdSetId");

-- CreateIndex
CREATE UNIQUE INDEX "ads_metaAdId_key" ON "ads"("metaAdId");

-- CreateIndex
CREATE INDEX "ads_adSetId_idx" ON "ads"("adSetId");

-- CreateIndex
CREATE INDEX "ads_metaAdId_idx" ON "ads"("metaAdId");

-- CreateIndex
CREATE INDEX "insights_entityType_entityId_date_idx" ON "insights"("entityType", "entityId", "date");

-- CreateIndex
CREATE INDEX "sync_logs_clientId_idx" ON "sync_logs"("clientId");

-- CreateIndex
CREATE INDEX "sync_logs_jobType_idx" ON "sync_logs"("jobType");

-- CreateIndex
CREATE INDEX "sync_logs_status_idx" ON "sync_logs"("status");

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_adAccountId_fkey" FOREIGN KEY ("adAccountId") REFERENCES "meta_ad_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_sets" ADD CONSTRAINT "ad_sets_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ads" ADD CONSTRAINT "ads_adSetId_fkey" FOREIGN KEY ("adSetId") REFERENCES "ad_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create partitions for insights table
CREATE TABLE "insights_2024_04" PARTITION OF "insights" FOR VALUES FROM ('2024-04-01') TO ('2024-05-01');
CREATE TABLE "insights_2024_05" PARTITION OF "insights" FOR VALUES FROM ('2024-05-01') TO ('2024-06-01');
CREATE TABLE "insights_2024_06" PARTITION OF "insights" FOR VALUES FROM ('2024-06-01') TO ('2024-07-01');
CREATE TABLE "insights_2024_07" PARTITION OF "insights" FOR VALUES FROM ('2024-07-01') TO ('2024-08-01');
CREATE TABLE "insights_2024_08" PARTITION OF "insights" FOR VALUES FROM ('2024-08-01') TO ('2024-09-01');
CREATE TABLE "insights_2024_09" PARTITION OF "insights" FOR VALUES FROM ('2024-09-01') TO ('2024-10-01');
CREATE TABLE "insights_2024_10" PARTITION OF "insights" FOR VALUES FROM ('2024-10-01') TO ('2024-11-01');
CREATE TABLE "insights_2024_11" PARTITION OF "insights" FOR VALUES FROM ('2024-11-01') TO ('2024-12-01');
CREATE TABLE "insights_2024_12" PARTITION OF "insights" FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');
CREATE TABLE "insights_2025_01" PARTITION OF "insights" FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE "insights_2025_02" PARTITION OF "insights" FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
CREATE TABLE "insights_2025_03" PARTITION OF "insights" FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');
CREATE TABLE "insights_2025_04" PARTITION OF "insights" FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');
