'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'
import { ArrowLeft, Wifi, WifiOff, RefreshCw, Trash2 } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import {
  getClient,
  getConnectUrl,
  checkMetaHealth,
  disconnectMeta,
  getSyncStatus,
  triggerSync,
} from '@/lib/clients'

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const accessToken = useAuthStore((s) => s.accessToken)
  const queryClient = useQueryClient()
  const [connectError, setConnectError] = useState<string | null>(null)
  const [healthResult, setHealthResult] = useState<string | null>(null)

  const { data: client, isLoading } = useQuery({
    queryKey: ['clients', id],
    queryFn: () => getClient(id, accessToken ?? ''),
    enabled: !!accessToken && !!id,
  })

  const { mutate: connectMeta, isPending: isConnecting } = useMutation({
    mutationFn: () => getConnectUrl(id, accessToken ?? ''),
    onSuccess: ({ url }) => {
      window.location.href = url
    },
    onError: (err) => setConnectError(err instanceof Error ? err.message : 'Erro ao gerar URL'),
  })

  const { mutate: healthCheck, isPending: isCheckingHealth } = useMutation({
    mutationFn: () => checkMetaHealth(id, accessToken ?? ''),
    onSuccess: (data) => {
      setHealthResult(data.isValid ? 'Token válido' : 'Token inválido ou expirado')
      void queryClient.invalidateQueries({ queryKey: ['clients', id] })
    },
    onError: (err) => setHealthResult(err instanceof Error ? err.message : 'Erro na verificação'),
  })

  const { mutate: disconnect, isPending: isDisconnecting } = useMutation({
    mutationFn: () => disconnectMeta(id, accessToken ?? ''),
    onSuccess: () => {
      setHealthResult(null)
      void queryClient.invalidateQueries({ queryKey: ['clients', id] })
    },
  })

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>
  if (!client) return <p className="text-sm text-destructive">Client não encontrado.</p>

  const connection = client.metaConnections?.[0]
  const isConnected = connection?.status === 'ACTIVE'

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/clients" className="rounded-md p-1 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{client.name}</h2>
          <p className="text-sm text-muted-foreground">
            Criado em {new Date(client.createdAt).toLocaleDateString('pt-BR')}
          </p>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Conexão Meta Ads</h3>
          {connection && (
            <span
              className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                isConnected
                  ? 'bg-green-500/10 text-green-600'
                  : 'bg-yellow-500/10 text-yellow-600'
              }`}
            >
              {isConnected ? (
                <><Wifi className="h-3 w-3" /> Ativa</>
              ) : (
                <><WifiOff className="h-3 w-3" /> {connection.status}</>
              )}
            </span>
          )}
        </div>

        {connection ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Business Manager</p>
                <p className="font-medium">{connection.businessName}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Contas de anúncio</p>
                <p className="font-medium">{connection.adAccounts?.length ?? 0} conta(s)</p>
              </div>
              {connection.lastValidatedAt && (
                <div>
                  <p className="text-muted-foreground">Última verificação</p>
                  <p className="font-medium">
                    {new Date(connection.lastValidatedAt).toLocaleString('pt-BR')}
                  </p>
                </div>
              )}
            </div>

            {connection.adAccounts?.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Contas vinculadas
                </p>
                {connection.adAccounts.map((acc) => (
                  <div
                    key={acc.id}
                    className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm"
                  >
                    <span className="font-medium">{acc.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {acc.accountId} · {acc.currency}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {healthResult && (
              <p className="rounded-md bg-muted px-3 py-2 text-sm">{healthResult}</p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => healthCheck()}
                disabled={isCheckingHealth}
                className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isCheckingHealth ? 'animate-spin' : ''}`} />
                Verificar saúde
              </button>
              <button
                onClick={() => disconnect()}
                disabled={isDisconnecting}
                className="flex items-center gap-1.5 rounded-md border border-destructive/30 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/5 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Desconectar
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Conecte uma conta Meta Ads para gerenciar campanhas deste cliente.
            </p>
            {connectError && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {connectError}
              </p>
            )}
            <button
              onClick={() => connectMeta()}
              disabled={isConnecting}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {isConnecting ? 'Redirecionando...' : 'Conectar Meta Ads'}
            </button>
          </div>
        )}
      </div>

      {connection && <SyncStatusCard clientId={id} accessToken={accessToken} />}
    </div>
  )
}

function SyncStatusCard({ clientId, accessToken }: { clientId: string; accessToken: string | null }) {
  const queryClient = useQueryClient()
  const { data: syncStatus, isLoading } = useQuery({
    queryKey: ['sync-status', clientId],
    queryFn: () => getSyncStatus(clientId, accessToken ?? ''),
    enabled: !!accessToken,
    refetchInterval: 30000, // Refresh every 30s
  })

  const { mutate: triggerSyncMutation, isPending: isTriggering } = useMutation({
    mutationFn: () => triggerSync(clientId, accessToken ?? ''),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sync-status', clientId] })
    },
  })

  return (
    <div className="rounded-lg border bg-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Status de Sincronização</h3>
        <button
          onClick={() => triggerSyncMutation()}
          disabled={isTriggering}
          className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isTriggering ? 'animate-spin' : ''}`} />
          Atualizar agora
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : syncStatus ? (
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-muted-foreground">Última sincronização</p>
              <p className="font-medium">
                {syncStatus.lastSync
                  ? new Date(syncStatus.lastSync).toLocaleString('pt-BR')
                  : 'Nunca'
                }
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Próxima agendada</p>
              <p className="font-medium">
                {new Date(syncStatus.nextScheduled).toLocaleString('pt-BR')}
              </p>
            </div>
          </div>
          <div>
            <Link
              href={`/clients/${clientId}/sync-logs`}
              className="text-sm font-medium text-primary hover:underline"
            >
              Ver histórico de logs de sincronização
            </Link>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Erro ao carregar status</p>
      )}
    </div>
  )
}
