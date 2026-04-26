'use client'

import { useRouter } from 'next/navigation'
import { User, Lock, Bell, Building2, LogOut } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { logout } from '@/lib/auth'

function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1]
    return JSON.parse(atob(payload))
  } catch {
    return null
  }
}

function SettingsSection({ title, icon: Icon, children }: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center gap-2 border-b px-5 py-4">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-semibold">{title}</h3>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  )
}

export default function SettingsPage() {
  const router = useRouter()
  const { accessToken, refreshToken, clearTokens } = useAuthStore()

  const payload = accessToken ? parseJwtPayload(accessToken) : null
  const email = typeof payload?.email === 'string' ? payload.email : '—'
  const name = typeof payload?.name === 'string' ? payload.name : '—'
  const role = typeof payload?.role === 'string' ? payload.role : '—'
  const tenantId = typeof payload?.tenantId === 'string' ? payload.tenantId : '—'

  async function handleLogout() {
    try {
      if (refreshToken) await logout(refreshToken)
    } catch {
      // ignora erro de rede no logout
    } finally {
      clearTokens()
      router.replace('/login')
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Configurações</h2>
        <p className="text-sm text-muted-foreground">Gerencie sua conta e preferências</p>
      </div>

      <SettingsSection title="Perfil" icon={User}>
        <InfoRow label="Nome" value={name} />
        <InfoRow label="E-mail" value={email} />
        <InfoRow label="Função" value={role} />
        <p className="mt-3 text-xs text-muted-foreground">
          Alteração de nome e senha disponível em versão futura.
        </p>
      </SettingsSection>

      <SettingsSection title="Empresa / Tenant" icon={Building2}>
        <InfoRow label="Tenant ID" value={tenantId} />
        <p className="mt-3 text-xs text-muted-foreground">
          Configurações de empresa disponíveis para administradores em versão futura.
        </p>
      </SettingsSection>

      <SettingsSection title="Segurança" icon={Lock}>
        <p className="text-sm text-muted-foreground">
          Autenticação de dois fatores (2FA) e gerenciamento de sessões disponíveis em versão futura.
        </p>
      </SettingsSection>

      <SettingsSection title="Notificações" icon={Bell}>
        <p className="text-sm text-muted-foreground">
          Alertas de performance e notificações de sync disponíveis em versão futura.
        </p>
      </SettingsSection>

      <div className="rounded-lg border border-destructive/30 bg-card">
        <div className="px-5 py-4">
          <h3 className="font-semibold text-destructive mb-1">Sair da conta</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Encerra sua sessão atual em todos os dispositivos.
          </p>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:opacity-90"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </div>
    </div>
  )
}
