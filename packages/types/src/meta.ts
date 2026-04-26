export type MetaCampaignStatus = 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED'

export type MetaObjective =
  | 'AWARENESS'
  | 'TRAFFIC'
  | 'ENGAGEMENT'
  | 'LEADS'
  | 'APP_PROMOTION'
  | 'SALES'

export type MetaInsight = {
  impressions: number
  clicks: number
  spend: number
  reach: number
  cpm: number
  cpc: number
  ctr: number
  dateStart: string
  dateStop: string
}
