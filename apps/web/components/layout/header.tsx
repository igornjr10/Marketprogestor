'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import { Sun, Moon, LogOut, Bell } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth.store'
import { logout } from '@/lib/auth'
import { getOpenAlertsCount } from '@/lib/alerts'

export function Header() {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const { refreshToken, clearTokens, accessToken } = useAuthStore()

  const { data: alertCount = 0 } = useQuery({
    queryKey: ['alert-badge'],
    queryFn: () => getOpenAlertsCount(accessToken ?? ''),
    enabled: !!accessToken,
    refetchInterval: 60000,
  })

  async function handleLogout() {
    if (refreshToken) await logout(refreshToken).catch(() => null)
    clearTokens()
    router.push('/login')
  }

  return (
    <header className="flex h-16 items-center justify-end gap-2 border-b bg-card px-6">
      <Link
        href="/alert-events"
        className="relative rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Alertas"
      >
        <Bell className="h-4 w-4" />
        {alertCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {alertCount > 9 ? '9+' : alertCount}
          </span>
        )}
      </Link>

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
