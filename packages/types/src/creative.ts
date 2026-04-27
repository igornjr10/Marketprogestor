export type FatigueLevel = 'NONE' | 'MODERATE' | 'SEVERE'

export type FatigueDetails = {
  level: FatigueLevel
  baselineCtr: number
  currentCtr: number
  delta: number
  frequency: number
}

export type CreativeCard = {
  id: string
  adId: string
  name: string
  status: string
  campaignId: string
  campaignName: string
  adSetId: string
  thumbnailUrl: string | null
  imageUrl: string | null
  videoId: string | null
  body: string | null
  title: string | null
  spend: number
  impressions: number
  clicks: number
  reach: number
  ctr: number
  cpm: number
  cpc: number
  frequency: number
  fatigue: FatigueDetails
}

export type CreativeTimeline = {
  date: string
  spend: number
  impressions: number
  clicks: number
  ctr: number
  frequency: number
}

export type CreativeGalleryPage = {
  creatives: CreativeCard[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export type BreakdownRow = {
  label: string
  spend: number
  impressions: number
  clicks: number
  reach: number
  ctr: number
  cpm: number
  pct: number
}

export type BreakdownResult = {
  dimension: string
  rows: BreakdownRow[]
  totals: { spend: number; impressions: number; clicks: number; reach: number }
}

export type HeatmapCell = {
  dim1: string
  dim2: string
  spend: number
  pct: number
}

export type HeatmapResult = {
  dim1Values: string[]
  dim2Values: string[]
  cells: HeatmapCell[]
}
