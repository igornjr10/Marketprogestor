export type CampaignStatus = 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED'

export type Campaign = {
  id: string
  adAccountId: string
  metaCampaignId: string
  name: string
  objective: string
  status: string
  dailyBudget: number | null
  lifetimeBudget: number | null
  startTime: string
  stopTime: string | null
  lastSyncedAt: string | null
  createdTime: string
  updatedTime: string
}

export type AdSet = {
  id: string
  campaignId: string
  metaAdSetId: string
  name: string
  status: string
  dailyBudget: number | null
  lifetimeBudget: number | null
  optimizationGoal: string
  billingEvent: string
  startTime: string
  endTime: string | null
  lastSyncedAt: string | null
}

export type Ad = {
  id: string
  adSetId: string
  metaAdId: string
  name: string
  status: string
  creativeId: string
  lastSyncedAt: string | null
}

export type CampaignDetail = Campaign & {
  adSets: Array<AdSet & { ads: Ad[] }>
}

export type CampaignPage = {
  campaigns: Campaign[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export type InsightTotals = {
  spend: number
  impressions: number
  reach: number
  clicks: number
  ctr: number
  cpm: number
  cpc: number
}

export type InsightByDate = {
  date: string
  spend: number
  clicks: number
  impressions: number
}

export type ClientInsights = {
  totals: InsightTotals
  byDate: InsightByDate[]
}

export type OverviewKpis = {
  spend: number
  impressions: number
  reach: number
  clicks: number
  ctr: number
  cpm: number
  cpc: number
}

export type OverviewResponse = {
  current: OverviewKpis
  previous: OverviewKpis | null
  deltas: Record<string, number | null> | null
}

export type TimeSeriesPoint = {
  date: string
  spend: number
  impressions: number
  clicks: number
  reach: number
  ctr: number
  cpm: number
  cpc: number
}

export type CampaignMetrics = {
  spend: number
  impressions: number
  clicks: number
  reach: number
  ctr: number
  cpm: number
  cpc: number
}

export type CampaignWithMetrics = Campaign & { metrics: CampaignMetrics }

export type CampaignMetricsPage = {
  campaigns: CampaignWithMetrics[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}
