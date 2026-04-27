import { apiFetch } from './api'
import type {
  AlertDto, AlertEventDto, AlertTestResult, AlertTemplate,
  CreateAlertDto, UpdateAlertDto,
} from '@marketproads/types'

export async function getAlertTemplates(token: string): Promise<AlertTemplate[]> {
  return apiFetch<AlertTemplate[]>('/alerts/templates', { token })
}

export async function getAlerts(token: string, clientId?: string): Promise<AlertDto[]> {
  const qs = clientId ? `?clientId=${clientId}` : ''
  return apiFetch<AlertDto[]>(`/alerts${qs}`, { token })
}

export async function createAlert(token: string, dto: CreateAlertDto): Promise<AlertDto> {
  return apiFetch<AlertDto>('/alerts', { token, method: 'POST', body: dto })
}

export async function updateAlert(token: string, alertId: string, dto: UpdateAlertDto): Promise<AlertDto> {
  return apiFetch<AlertDto>(`/alerts/${alertId}`, { token, method: 'PATCH', body: dto })
}

export async function deleteAlert(token: string, alertId: string): Promise<void> {
  return apiFetch<void>(`/alerts/${alertId}`, { token, method: 'DELETE' })
}

export async function testAlert(token: string, alertId: string): Promise<AlertTestResult> {
  return apiFetch<AlertTestResult>(`/alerts/${alertId}/test`, { token, method: 'POST' })
}

export async function getAlertEvents(token: string, alertId?: string, status?: string): Promise<AlertEventDto[]> {
  const q = new URLSearchParams()
  if (alertId) q.set('alertId', alertId)
  if (status) q.set('status', status)
  const qs = q.toString() ? `?${q.toString()}` : ''
  const path = alertId ? `/alerts/${alertId}/events${qs}` : `/alert-events${qs}`
  return apiFetch<AlertEventDto[]>(path, { token })
}

export async function resolveAlertEvent(token: string, eventId: string): Promise<void> {
  return apiFetch<void>(`/alert-events/${eventId}/resolve`, { token, method: 'PATCH' })
}

export async function getOpenAlertsCount(token: string): Promise<number> {
  return apiFetch<number>('/alerts/badge/count', { token })
}
