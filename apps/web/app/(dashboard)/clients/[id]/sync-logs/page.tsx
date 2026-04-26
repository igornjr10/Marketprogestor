'use client'

import { useQuery } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import { ArrowLeft, Clock4, ListChecks } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { getSyncLogs } from '@/lib/clients'

export default function ClientSyncLogsPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const accessToken = useAuthStore((s) => s.accessToken)
  const [page] = useState(1)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['sync-logs', id, page],
    queryFn: () => getSyncLogs(id, accessToken ?? '', page, 20),
    enabled: !!accessToken && !!id,
  })

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="rounded-md p-1 hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Logs de Sincronização</h2>
          <p className="text-sm text-muted-foreground">Histórico de jobs criados para este cliente.</p>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando logs...</p>
        ) : isError || !data ? (
          <p className="text-sm text-destructive">Não foi possível carregar os logs.</p>
        ) : data.logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum log encontrado ainda.</p>
        ) : (
          <div className="space-y-4">
            {data.logs.map((log) => (
              <div key={log.id} className="rounded-lg border bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <ListChecks className="h-4 w-4" />
                    <span className="font-medium">{log.jobType}</span>
                  </div>
                  <span>{log.status}</span>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Início</p>
                    <p className="font-medium">
                      {log.startedAt ? new Date(log.startedAt).toLocaleString('pt-BR') : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Fim</p>
                    <p className="font-medium">
                      {log.finishedAt ? new Date(log.finishedAt).toLocaleString('pt-BR') : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Registros</p>
                    <p className="font-medium">{log.itemsProcessed}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Duração</p>
                    <p className="font-medium">
                      {log.durationMs !== null ? `${log.durationMs} ms` : '—'}
                    </p>
                  </div>
                </div>
                {log.error && (
                  <div className="mt-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                    <p className="font-semibold">Erro</p>
                    <p>{log.error}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
