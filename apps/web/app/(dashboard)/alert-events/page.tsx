'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCircle, ArrowLeft, AlertTriangle, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/auth.store'
import { getAlertEvents, resolveAlertEvent } from '@/lib/alerts'
import type { AlertEventDto } from '@marketproads/types'

const METRIC_LABELS: Record<string, string> = {
  spend: 'Spend', ctr: 'CTR', cpm: 'CPM', frequency: 'Frequência', cpa: 'CPA', roas: 'ROAS',
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

export default function AlertEventsPage() {
  const accessToken = useAuthStore((s) => s.accessToken)
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<'OPEN' | 'RESOLVED' | ''>('')

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['alert-events', statusFilter],
    queryFn: () => getAlertEvents(accessToken ?? '', undefined, statusFilter || undefined),
    enabled: !!accessToken,
    refetchInterval: 60000,
  })

  const resolveMutation = useMutation({
    mutationFn: (eventId: string) => resolveAlertEvent(accessToken ?? '', eventId),
    onSuccess: () => {
      toast.success('Evento marcado como resolvido')
      void queryClient.invalidateQueries({ queryKey: ['alert-events'] })
      void queryClient.invalidateQueries({ queryKey: ['alert-badge'] })
    },
    onError: () => toast.error('Erro ao resolver evento'),
  })

  const openCount = events.filter((e) => e.status === 'OPEN').length

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/alerts" className="rounded-md p-1 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            Eventos de Alerta
            {openCount > 0 && (
              <span className="rounded-full bg-red-500 px-2.5 py-0.5 text-sm font-bold text-white">
                {openCount}
              </span>
            )}
          </h2>
          <p className="text-sm text-muted-foreground">Histórico de alertas disparados</p>
        </div>
      </div>

      <div className="flex gap-2">
        {(['', 'OPEN', 'RESOLVED'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${statusFilter === s ? 'bg-primary text-primary-foreground' : 'border hover:bg-muted'}`}
          >
            {s === '' ? 'Todos' : s === 'OPEN' ? 'Abertos' : 'Resolvidos'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />)}
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center">
          <Bell className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="font-medium">Nenhum evento encontrado</p>
          <p className="text-sm text-muted-foreground mt-1">
            {statusFilter === 'OPEN' ? 'Nenhum alerta aberto no momento.' : 'Nenhum evento para os filtros selecionados.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <AlertEventRow key={event.id} event={event} onResolve={() => resolveMutation.mutate(event.id)} />
          ))}
        </div>
      )}
    </div>
  )
}

function AlertEventRow({ event, onResolve }: { event: AlertEventDto; onResolve: () => void }) {
  const isOpen = event.status === 'OPEN'

  return (
    <div className={`rounded-lg border bg-card p-4 ${isOpen ? 'border-red-200 bg-red-50/30' : ''}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 rounded-full p-1 ${isOpen ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
            {isOpen ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
          </div>
          <div>
            <p className="font-semibold text-sm">{event.alertName}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Campanha: {event.entityName}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Valor: <span className="font-medium">{event.metricValue.toFixed(2)}</span>
              {' · '}
              <span className="inline-flex items-center gap-0.5">
                <Clock className="h-3 w-3" /> {fmtDate(event.triggeredAt)}
              </span>
            </p>
            {!isOpen && event.resolvedAt && (
              <p className="text-xs text-green-700 mt-0.5">
                Resolvido em {fmtDate(event.resolvedAt)}
              </p>
            )}
          </div>
        </div>

        {isOpen && (
          <button
            onClick={onResolve}
            className="shrink-0 flex items-center gap-1.5 rounded-md border border-green-300 px-2.5 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50"
          >
            <CheckCircle className="h-3.5 w-3.5" /> Resolver
          </button>
        )}
      </div>
    </div>
  )
}
