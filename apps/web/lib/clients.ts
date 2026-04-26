import { apiFetch } from './api'
import type { Client, CreateClientInput, MetaCallbackResult, FinalizeMetaInput } from '@marketproads/types'

type ClientDetail = Client & {
  metaConnections: Array<{
    id: string
    businessId: string
    businessName: string
    status: string
    lastValidatedAt: string | null
    adAccounts: Array<{
      id: string
      accountId: string
      name: string
      currency: string
      timezone: string
      status: string
    }>
  }>
}

export async function getClients(token: string): Promise<Client[]> {
  return apiFetch<Client[]>('/clients', { token })
}

export async function getClient(id: string, token: string): Promise<ClientDetail> {
  return apiFetch<ClientDetail>(`/clients/${id}`, { token })
}

export async function createClient(input: CreateClientInput, token: string): Promise<Client> {
  return apiFetch<Client>('/clients', { method: 'POST', body: input, token })
}

export async function deleteClient(id: string, token: string): Promise<void> {
  return apiFetch<void>(`/clients/${id}`, { method: 'DELETE', token })
}

export async function getConnectUrl(id: string, token: string): Promise<{ url: string }> {
  return apiFetch<{ url: string }>(`/clients/${id}/meta/connect-url`, { token })
}

export async function handleMetaCallback(
  clientId: string,
  code: string,
  token: string,
): Promise<MetaCallbackResult> {
  return apiFetch<MetaCallbackResult>(
    `/clients/${clientId}/meta/callback?code=${encodeURIComponent(code)}`,
    { token },
  )
}

export async function finalizeMetaConnection(
  id: string,
  input: FinalizeMetaInput,
  token: string,
): Promise<void> {
  return apiFetch<void>(`/clients/${id}/meta/finalize`, { method: 'POST', body: input, token })
}

export async function checkMetaHealth(
  id: string,
  token: string,
): Promise<{ status: string; isValid: boolean; scopes: string[] }> {
  return apiFetch<{ status: string; isValid: boolean; scopes: string[] }>(
    `/clients/${id}/meta/health`,
    { token },
  )
}

export async function disconnectMeta(id: string, token: string): Promise<void> {
  return apiFetch<void>(`/clients/${id}/meta`, { method: 'DELETE', token })
}
