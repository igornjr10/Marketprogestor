import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type AuthState = {
  accessToken: string | null
  refreshToken: string | null
  setTokens: (tokens: { accessToken: string; refreshToken: string }) => void
  clearTokens: () => void
}

function setCookie(name: string, value: string, maxAge: number): void {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=${value}; path=/; max-age=${maxAge}; SameSite=Strict`
}

function clearCookie(name: string): void {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=; path=/; max-age=0`
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      setTokens: (tokens) => {
        set(tokens)
        setCookie('access_token', tokens.accessToken, 900)
      },
      clearTokens: () => {
        set({ accessToken: null, refreshToken: null })
        clearCookie('access_token')
      },
    }),
    { name: 'auth-storage' },
  ),
)
