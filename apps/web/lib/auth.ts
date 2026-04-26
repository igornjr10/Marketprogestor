import { apiFetch } from './api'
import type { AuthTokens, LoginInput, RegisterInput } from '@marketproads/types'

export async function login(input: LoginInput): Promise<AuthTokens> {
  return apiFetch<AuthTokens>('/auth/login', { method: 'POST', body: input })
}

export async function register(input: RegisterInput): Promise<AuthTokens> {
  return apiFetch<AuthTokens>('/auth/register', { method: 'POST', body: input })
}

export async function logout(refreshToken: string): Promise<void> {
  return apiFetch<void>('/auth/logout', { method: 'POST', body: { refreshToken } })
}

export async function refreshTokens(refreshToken: string): Promise<AuthTokens> {
  return apiFetch<AuthTokens>('/auth/refresh', { method: 'POST', body: { refreshToken } })
}
