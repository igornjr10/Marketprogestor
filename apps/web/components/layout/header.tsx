'use client'

import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { Sun, Moon, LogOut } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { logout } from '@/lib/auth'

export function Header() {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const { refreshToken, clearTokens } = useAuthStore()

  async function handleLogout() {
    if (refreshToken) await logout(refreshToken).catch(() => null)
    clearTokens()
    router.push('/login')
  }

  return (
    <header className="flex h-16 items-center justify-end gap-2 border-b bg-card px-6">
      <button
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Alternar tema"
      >
        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>

      <button
        onClick={handleLogout}
        className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <LogOut className="h-4 w-4" />
        Sair
      </button>
    </header>
  )
}
