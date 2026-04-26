const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

type RequestOptions = {
  method?: string
  body?: unknown
  token?: string
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token } = options

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_URL}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Erro desconhecido' }))
    throw new Error(error.message ?? 'Erro na requisição')
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}
