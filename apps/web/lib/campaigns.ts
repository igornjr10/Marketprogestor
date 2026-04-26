import { apiFetch } from './api'
import type { CampaignPage, CampaignDetail, ClientInsights, OverviewResponse, TimeSeriesPoint, CampaignMetricsPage } from '@marketproads/types'

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
