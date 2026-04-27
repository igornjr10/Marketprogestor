'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAuditLogs } from '@/lib/campaigns'
import type { AuditLogEntry } from '@marketproads/types'

type Props = {
  clientId: string
  token: string
  entityId?: string
  entityType?: string
}

function formatValue(val: Record<string, unknown> | null): string {
  if (!val) return '—'
  return Object.entries(val)
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join(', ')
}

function ActionBadge({ action }: { action: string }) {
  const colors: Record<string, string> = {
    STATUS_CHANGE: 'bg-blue-100 text-blue-700',
    BUDGET_UPDATE: 'bg-orange-100 text-orange-700',
    CAMPAIGN_DUPLICATED: 'bg-purple-100 text-purple-700',
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors[action] ?? 'bg-zinc-100 text-zinc-600'}`}>
      {action.replace(/_/g, ' ')}
    </span>
  )
}

export function AuditLogPanel({ clientId, token, entityId, entityType }: Props) {
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery<AuditLogEntry[]>({
    queryKey: ['audit-logs', clientId, entityId, entityType, page],
    queryFn: () => getAuditLogs(clientId, token, { entityId, entityType, page, limit: 10 }),
    enabled: !!token,
  })

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
        ))}
      </div>
    )
  }

  if (!data?.length) {
    return <p className="text-sm text-zinc-500">Nenhum registro de auditoria encontrado.</p>
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-700">
              <th className="py-2 text-left font-medium text-zinc-500">Data</th>
              <th className="py-2 text-left font-medium text-zinc-500">Usuário</th>
              <th className="py-2 text-left font-medium text-zinc-500">Ação</th>
              <th className="py-2 text-left font-medium text-zinc-500">Antes</th>
              <th className="py-2 text-left font-medium text-zinc-500">Depois</th>
            </tr>
          </thead>
          <tbody>
            {data.map((entry) => (
              <tr key={entry.id} className="border-b border-zinc-100 dark:border-zinc-800">
                <td className="py-2 pr-4 text-zinc-500 whitespace-nowrap">
                  {new Date(entry.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                </td>
                <td className="py-2 pr-4 text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                  {entry.user.name}
                </td>
                <td className="py-2 pr-4">
                  <ActionBadge action={entry.action} />
                </td>
                <td className="py-2 pr-4 text-zinc-500 max-w-[160px] truncate">{formatValue(entry.before)}</td>
                <td className="py-2 text-zinc-700 dark:text-zinc-300 max-w-[160px] truncate">{formatValue(entry.after)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-zinc-500">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
          className="rounded border border-zinc-200 px-3 py-1 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700"
        >
          Anterior
        </button>
        <span>Página {page}</span>
        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={(data?.length ?? 0) < 10}
          className="rounded border border-zinc-200 px-3 py-1 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700"
        >
          Próxima
        </button>
      </div>
    </div>
  )
}
