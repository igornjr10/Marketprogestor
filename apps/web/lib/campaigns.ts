import { apiFetch } from './api'
import type {
  CampaignPage, CampaignDetail, ClientInsights, OverviewResponse, TimeSeriesPoint,
  CampaignMetricsPage, AuditLogEntry, DryRunResult, DuplicateOptions, Campaign,
} from '@marketproads/types'

export async function getCampaigns(
  clientId: string,
  token: string,
  params: { status?: string; page?: number; limit?: number } = {},
): Promise<CampaignPage> {
  const q = new URLSearchParams()
  if (params.status) q.set('status', params.status)
  if (params.page) q.set('page', String(params.page))
  if (params.limit) q.set('limit', String(params.limit))
  const qs = q.toString() ? `?${q.toString()}` : ''
  return apiFetch<CampaignPage>(`/clients/${clientId}/campaigns${qs}`, { token })
}

export async function getCampaign(
  clientId: string,
  campaignId: string,
  token: string,
): Promise<CampaignDetail> {
  return apiFetch<CampaignDetail>(`/clients/${clientId}/campaigns/${campaignId}`, { token })
}

export async function getClientInsights(
  clientId: string,
  token: string,
  period = 30,
): Promise<ClientInsights> {
  return apiFetch<ClientInsights>(`/clients/${clientId}/campaigns/insights?period=${period}`, { token })
}

export async function getOverview(
  clientId: string,
  token: string,
  period = 30,
  compare = true,
): Promise<OverviewResponse> {
  return apiFetch<OverviewResponse>(
    `/clients/${clientId}/overview?period=${period}&compare=${compare}`,
    { token },
  )
}

export async function getTimeSeries(
  clientId: string,
  token: string,
  period = 30,
  granularity = 'day',
  metrics: string[] = ['spend'],
): Promise<TimeSeriesPoint[]> {
  const q = new URLSearchParams({ period: String(period), granularity, metrics: metrics.join(',') })
  return apiFetch<TimeSeriesPoint[]>(`/clients/${clientId}/time-series?${q.toString()}`, { token })
}

export async function getCampaignsWithMetrics(
  clientId: string,
  token: string,
  params: { period?: number; status?: string; sort?: string; page?: number; limit?: number } = {},
): Promise<CampaignMetricsPage> {
  const q = new URLSearchParams()
  if (params.period) q.set('period', String(params.period))
  if (params.status) q.set('status', params.status)
  if (params.sort) q.set('sort', params.sort)
  if (params.page) q.set('page', String(params.page))
  if (params.limit) q.set('limit', String(params.limit))
  return apiFetch<CampaignMetricsPage>(`/clients/${clientId}/campaigns-metrics?${q.toString()}`, { token })
}

function mutationHeaders(token: string, idempotencyKey?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey
  return headers
}

export async function updateCampaignStatus(
  clientId: string,
  campaignId: string,
  status: string,
  token: string,
  idempotencyKey?: string,
): Promise<Campaign> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/clients/${clientId}/campaigns/${campaignId}`,
    { method: 'PATCH', headers: mutationHeaders(token, idempotencyKey), body: JSON.stringify({ status }) },
  )
  if (!res.ok) throw new Error(await res.text())
  return res.json() as Promise<Campaign>
}

export async function updateCampaignBudget(
  clientId: string,
  campaignId: string,
  budget: { dailyBudget?: number; lifetimeBudget?: number },
  token: string,
  idempotencyKey?: string,
): Promise<Campaign> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/clients/${clientId}/campaigns/${campaignId}`,
    { method: 'PATCH', headers: mutationHeaders(token, idempotencyKey), body: JSON.stringify(budget) },
  )
  if (!res.ok) throw new Error(await res.text())
  return res.json() as Promise<Campaign>
}

export async function updateAdSetStatus(
  clientId: string,
  adSetId: string,
  status: string,
  token: string,
  idempotencyKey?: string,
): Promise<unknown> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/clients/${clientId}/campaigns/adsets/${adSetId}`,
    { method: 'PATCH', headers: mutationHeaders(token, idempotencyKey), body: JSON.stringify({ status }) },
  )
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function updateAdSetBudget(
  clientId: string,
  adSetId: string,
  budget: { dailyBudget?: number; lifetimeBudget?: number },
  token: string,
  idempotencyKey?: string,
): Promise<unknown> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/clients/${clientId}/campaigns/adsets/${adSetId}`,
    { method: 'PATCH', headers: mutationHeaders(token, idempotencyKey), body: JSON.stringify(budget) },
  )
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function dryRunCampaign(
  clientId: string,
  campaignId: string,
  changes: Record<string, unknown>,
  token: string,
): Promise<DryRunResult> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/clients/${clientId}/campaigns/${campaignId}/dry-run`,
    { method: 'POST', headers: mutationHeaders(token), body: JSON.stringify(changes) },
  )
  if (!res.ok) throw new Error(await res.text())
  return res.json() as Promise<DryRunResult>
}

export async function duplicateCampaign(
  clientId: string,
  campaignId: string,
  options: DuplicateOptions,
  token: string,
): Promise<Campaign> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/clients/${clientId}/campaigns/${campaignId}/duplicate`,
    { method: 'POST', headers: mutationHeaders(token), body: JSON.stringify(options) },
  )
  if (!res.ok) throw new Error(await res.text())
  return res.json() as Promise<Campaign>
}

export async function getAuditLogs(
  clientId: string,
  token: string,
  params: { entityType?: string; entityId?: string; page?: number; limit?: number } = {},
): Promise<AuditLogEntry[]> {
  const q = new URLSearchParams()
  if (params.entityType) q.set('entityType', params.entityType)
  if (params.entityId) q.set('entityId', params.entityId)
  if (params.page) q.set('page', String(params.page))
  if (params.limit) q.set('limit', String(params.limit))
  return apiFetch<AuditLogEntry[]>(`/clients/${clientId}/campaigns/audit-logs?${q.toString()}`, { token })
}
