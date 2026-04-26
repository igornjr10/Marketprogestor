export type ClientStatus = 'ACTIVE' | 'INACTIVE' | 'DELETED'
export type MetaConnectionStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'ERROR'

export type Client = {
  id: string
  tenantId: string
  name: string
  status: ClientStatus
  createdAt: string
  updatedAt: string
  metaConnection?: MetaConnectionSummary
}

export type MetaConnectionSummary = {
  id: string
  businessId: string
  businessName: string
  status: MetaConnectionStatus
  lastValidatedAt: string | null
  adAccountCount: number
}

export type SyncStatus = {
  lastSync: string | null
  nextScheduled: string
  status: string
}

export type SyncLogEntry = {
  id: string
  jobType: 'STRUCTURE' | 'INSIGHTS_FRESH' | 'INSIGHTS_HISTORICAL' | 'CREATIVES'
  status: string
  startedAt: string | null
  finishedAt: string | null
  itemsProcessed: number
  error: string | null
  durationMs: number | null
}

export type SyncLogPage = {
  logs: SyncLogEntry[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export type MetaBusiness = {
  id: string
  name: string
}

export type MetaAdAccountInfo = {
  id: string
  account_id: string
  name: string
  currency: string
  timezone_name: string
  account_status: number
}

export type MetaCallbackResult = {
  tokenData: string
  businesses: MetaBusiness[]
  adAccounts: Record<string, MetaAdAccountInfo[]>
}

export type CreateClientInput = {
  name: string
}

export type FinalizeMetaInput = {
  businessId: string
  businessName: string
  adAccountIds: string[]
  tokenData: string
}
