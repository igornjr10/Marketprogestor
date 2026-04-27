'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Bell, Trash2, ToggleLeft, ToggleRight, CheckCircle, AlertTriangle, FlaskConical } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/auth.store'
import { getAlerts, deleteAlert, updateAlert, testAlert } from '@/lib/alerts'
import type { AlertDto, AlertTestResult } from '@marketproads/types'

const METRIC_LABELS: Record<string, string> = {
  spend: 'Spend', ctr: 'CTR', cpm: 'CPM', frequency: 'Frequência', cpa: 'CPA', roas: 'ROAS',
}
const COMPARATOR_LABELS: Record<string, string> = {
  gt: '>', gte: '≥', lt: '<', lte: '≤', eq: '=', change_pct: 'variação %',
}
const PERIOD_LABELS: Record<string, string> = {
  '1d': '1 dia', '3d': '3 dias', '7d': '7 dias', '14d': '14 dias', '30d': '30 dias',
}

function ruleDescription(rule: AlertDto['rule']): string {
  return rule.conditions
    .map((c) => `${METRIC_LABELS[c.metric] ?? c.metric} ${COMPARATOR_LABELS[c.comparator] ?? c.comparator} ${c.value} (${PERIOD_LABELS[c.period] ?? c.period})`)
    .join(` ${rule.operator === 'AND' ? 'E' : 'OU'} `)
}

export default function AlertsPage() {
  const accessToken = useAuthStore((s) => s.accessToken)
  const queryClient = useQueryClient()
  const [testResult, setTestResult] = useState<{ alertId: string; result: AlertTestResult } | null>(null)

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => getAlerts(accessToken ?? ''),
    enabled: !!accessToken,
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updateAlert(accessToken ?? '', id, { isActive }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['alerts'] }),
    onError: () => toast.error('Erro ao atualizar alerta'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAlert(accessToken ?? '', id),
    onSuccess: () => {
      toast.success('Alerta removido')
      void queryClient.invalidateQueries({ queryKey: ['alerts'] })
    },
    onError: () => toast.error('Erro ao remover alerta'),
  })

  const testMutation = useMutation({
    mutationFn: (id: string) => testAlert(accessToken ?? '', id),
    onSuccess: (result, id) => {
      setTestResult({ alertId: id, result })
      toast.info(result.wouldTrigger ? 'Alerta dispararia agora' : 'Alerta NÃO dispararia agora')
    },
    onError: () => toast.error('Erro ao testar alerta'),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Alertas</h2>
          <p className="text-sm text-muted-foreground">Monitore métricas e seja notificado automaticamente</p>
        </div>
        <div className="flex gap-2">
          <Link href="/alert-events" className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
            <Bell className="h-4 w-4" /> Eventos
          </Link>
          <Link href="/alerts/new" className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90">
            <Plus className="h-4 w-4" /> Novo alerta
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />)}
        </div>
      ) : alerts.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center">
          <Bell className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="font-medium">Nenhum alerta configurado</p>
          <p className="text-sm text-muted-foreground mt-1">Crie alertas para monitorar métricas automaticamente</p>
          <Link href="/alerts/new" className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            <Plus className="h-4 w-4" /> Criar primeiro alerta
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <AlertRow
              key={alert.id}
              alert={alert}
              testResult={testResult?.alertId === alert.id ? testResult.result : undefined}
              onToggle={() => toggleMutation.mutate({ id: alert.id, isActive: !alert.isActive })}
              onDelete={() => deleteMutation.mutate(alert.id)}
              onTest={() => testMutation.mutate(alert.id)}
              isTesting={testMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function AlertRow({
  alert, testResult, onToggle, onDelete, onTest, isTesting,
}: {
  alert: AlertDto
  testResult?: AlertTestResult
  onToggle: () => void
  onDelete: () => void
  onTest: () => void
  isTesting: boolean
}) {
  return (
    <div className={`rounded-lg border bg-card p-4 ${!alert.isActive ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold truncate">{alert.name}</p>
            {alert.openEventCount > 0 && (
              <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
                {alert.openEventCount}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{ruleDescription(alert.rule)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Cooldown: {alert.cooldownMinutes}min · {alert.channels.email ? 'Email + Dashboard' : 'Dashboard'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onTest}
            disabled={isTesting}
            title="Testar agora"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-40"
          >
            <FlaskConical className="h-4 w-4" />
          </button>
          <button
            onClick={onToggle}
            title={alert.isActive ? 'Desativar' : 'Ativar'}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
          >
            {alert.isActive
              ? <ToggleRight className="h-5 w-5 text-green-500" />
              : <ToggleLeft className="h-5 w-5" />}
          </button>
          <button
            onClick={onDelete}
            title="Excluir"
            className="rounded-md p-1.5 text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {testResult && (
        <div className={`mt-3 rounded-md px-3 py-2 text-xs ${testResult.wouldTrigger ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          <span className="inline-flex items-center gap-1 font-medium">
            {testResult.wouldTrigger
              ? <><AlertTriangle className="h-3.5 w-3.5" /> Dispararia agora</>
              : <><CheckCircle className="h-3.5 w-3.5" /> Não dispararia</>}
          </span>
          <span className="ml-2">{testResult.entitiesChecked} campanhas avaliadas, {testResult.entitiesMatching} correspondentes</span>
        </div>
      )}
    </div>
  )
}
