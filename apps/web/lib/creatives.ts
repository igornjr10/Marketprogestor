import { apiFetch } from './api'
import type { CreativeGalleryPage, CreativeCard, CreativeTimeline, BreakdownResult, HeatmapResult } from '@marketproads/types'

export async function getCreativesGallery(
  clientId: string,
  token: string,
  params: { period?: number; sort?: string; fatigue?: string; page?: number; limit?: number } = {},
): Promise<CreativeGalleryPage> {
  const q = new URLSearchParams()
  if (params.period) q.set('period', String(params.period))
  if (params.sort) q.set('sort', params.sort)
  if (params.fatigue) q.set('fatigue', params.fatigue)
  if (params.page) q.set('page', String(params.page))
  if (params.limit) q.set('limit', String(params.limit))
  const qs = q.toString() ? `?${q.toString()}` : ''
  return apiFetch<CreativeGalleryPage>(`/clients/${clientId}/creatives${qs}`, { token })
}

export async function getCreativeDetails(
  clientId: string,
  adId: string,
  token: string,
  period = 30,
): Promise<CreativeCard> {
  return apiFetch<CreativeCard>(`/clients/${clientId}/creatives/${adId}/details?period=${period}`, { token })
}

export async function getCreativeTimeline(
  clientId: string,
  adId: string,
  token: string,
): Promise<CreativeTimeline[]> {
  return apiFetch<CreativeTimeline[]>(`/clients/${clientId}/creatives/${adId}/timeline`, { token })
}

export async function getBreakdown(
  clientId: string,
  token: string,
  dimension: string,
  period = 30,
): Promise<BreakdownResult> {
  return apiFetch<BreakdownResult>(`/clients/${clientId}/breakdowns?dimension=${dimension}&period=${period}`, { token })
}

export async function getHeatmap(
  clientId: string,
  token: string,
  dim1: string,
  dim2: string,
  period = 30,
): Promise<HeatmapResult> {
  return apiFetch<HeatmapResult>(`/clients/${clientId}/breakdowns/heatmap?dim1=${dim1}&dim2=${dim2}&period=${period}`, { token })
}
