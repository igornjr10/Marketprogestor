export type MetaCampaign = {
  id: string
  name: string
  objective: string
  status: string
  daily_budget?: number | null
  lifetime_budget?: number | null
  start_time: string
  stop_time?: string | null
  created_time: string
  updated_time: string
}

export type MetaAdSet = {
  id: string
  name: string
  status: string
  campaign_id: string
  daily_budget?: number | null
  lifetime_budget?: number | null
  targeting: Record<string, unknown>
  optimization_goal: string
  billing_event: string
  start_time: string
  end_time?: string | null
  created_time: string
  updated_time: string
}

export type MetaAd = {
  id: string
  name: string
  status: string
  adset_id: string
  campaign_id: string
  creative_id: string
  created_time: string
  updated_time: string
  creative?: Record<string, unknown>
}

export type MetaCreativeRow = {
  id: string
  creative_id: string
  adset_id: string
  name: string
  status: string
  creative?: Record<string, unknown>
}

export type MetaInsightRow = {
  date_start: string
  date_stop: string
  spend: string
  impressions: string
  reach: string
  clicks: string
  frequency?: string
  actions?: Array<Record<string, unknown>>
  video_30_sec_watched_actions?: Array<Record<string, unknown>>
  breakdowns?: Record<string, unknown>
  campaign_id?: string
  adset_id?: string
  ad_id?: string
}

export type MetaBreakdownRow = {
  spend: string
  impressions: string
  reach: string
  clicks: string
  frequency?: string
  date_start: string
  date_stop: string
  age?: string
  gender?: string
  device_platform?: string
  publisher_platform?: string
  country?: string
  campaign_id?: string
}

export type MetaPaginatedResponse<T> = {
  data: T[]
  paging?: {
    cursors?: { before?: string; after?: string }
    next?: string
  }
}
