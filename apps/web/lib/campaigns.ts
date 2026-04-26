import { apiFetch } from './api'
import type { CampaignPage, CampaignDetail, ClientInsights } from '@marketproads/types'

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
