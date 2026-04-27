'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/auth.store'
import { createAlert, getAlertTemplates } from '@/lib/alerts'
import type { AlertCondition, AlertRule, AlertChannels, CreateAlertDto, AlertTemplate } from '@marketproads/types'
import { ALERT_TEMPLATES } from '@marketproads/types'

const METRICS = ['spend', 'ctr', 'cpm', 'frequency', 'cpa', 'roas'] as const
const COMPARATORS = ['gt', 'gte', 'lt', 'lte', 'eq', 'change_pct'] as const
const PERIODS = ['1d', '3d', '7d', '14d', '30d'] as const

const METRIC_LABELS: Record<string, string> = {
  spend: 'Spend (R$)', ctr: 'CTR (%)', cpm: 'CPM (R$)', frequency: 'Frequência', cpa: 'CPA (R$)', roas: 'ROAS',
}
const COMPARATOR_LABELS: Record<string, string> = {
  gt: '> Maior que', gte: '≥ Maior ou igual', lt: '< Menor que', lte: '≤ Menor ou igual', eq: '= Igual a', change_pct: '% Variação %',
}
const PERIOD_LABELS: Record<string, string> = {
  '1d': '1 dia', '3d': '3 dias', '7d': '7 dias', '14d': '14 dias', '30d': '30 dias',
}

const defaultCondition = (): AlertCondition => ({
  metric: 'ctr', comparator: 'lt', value: 1, period: '7d',
})

type WizardState = {
  name: string
  description: string
  clientId: string
  conditions: AlertCondition[]
  operator: 'AND' | 'OR'
  channels: AlertChannels
  cooldownMinutes: number
  notifyEmail: string
}

const initial: WizardState = {
  name: '', description: '', clientId: '',
  conditions: [defaultCondition()],
  operator: 'AND',
  channels: { dashboard: true, email: false },
  cooldownMinutes: 60,
  notifyEmail: '',
}

export default function NewAlertPage() {
  const router = useRouter()
  const accessToken = useAuthStore((s) => s.accessToken)
  const [step, setStep] = useState(1)
  const [state, setState] = useState<WizardState>(initial)

  const mutation = useMutation({
    mutationFn: (dto: CreateAlertDto) => createAlert(accessToken ?? '', dto),
    onSuccess: () => {
      toast.success('Alerta criado com sucesso')
      router.push('/alerts')
    },
    onError: () => toast.error('Erro ao criar alerta'),
  })

  const applyTemplate = (tpl: AlertTemplate) => {
    setState((s) => ({
      ...s,
      name: tpl.name,
      description: tpl.description,
      conditions: tpl.rule.conditions,
      operator: tpl.rule.operator,
      cooldownMinutes: tpl.defaultCooldownMinutes,
    }))
    setStep(2)
  }

  const submit = () => {
    const dto: CreateAlertDto = {
      name: state.name,
      description: state.description || undefined,
      clientId: state.clientId || undefined,
      rule: { conditions: state.conditions, operator: state.operator },
      channels: state.channels,
      cooldownMinutes: state.cooldownMinutes,
      notifyEmail: state.channels.email && state.notifyEmail ? state.notifyEmail : undefined,
    }
    mutation.mutate(dto)
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/alerts" className="rounded-md p-1 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Novo Alerta</h2>
          <p className="text-sm text-muted-foreground">Passo {step} de 4</p>
        </div>
      </div>

      <div className="flex gap-1 mb-2">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className={`h-1.5 flex-1 rounded-full ${s <= step ? 'bg-primary' : 'bg-muted'}`} />
        ))}
      </div>

      {step === 1 && (
        <Step1
          state={state}
          setState={setState}
          onNext={() => setStep(2)}
          templates={ALERT_TEMPLATES}
          onTemplate={applyTemplate}
        />
      )}
      {step === 2 && (
        <Step2 state={state} setState={setState} onBack={() => setStep(1)} onNext={() => setStep(3)} />
      )}
      {step === 3 && (
        <Step3 state={state} setState={setState} onBack={() => setStep(2)} onNext={() => setStep(4)} />
      )}
      {step === 4 && (
        <Step4 state={state} onBack={() => setStep(3)} onSubmit={submit} isPending={mutation.isPending} />
      )}
    </div>
  )
}

function Step1({ state, setState, onNext, templates, onTemplate }: {
  state: WizardState
  setState: React.Dispatch<React.SetStateAction<WizardState>>
  onNext: () => void
  templates: AlertTemplate[]
  onTemplate: (t: AlertTemplate) => void
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <h3 className="font-semibold">Identificação</h3>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Nome do alerta *</label>
            <input
              value={state.name}
              onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
              placeholder="Ex.: CTR em queda por 3 dias"
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Descrição</label>
            <input
              value={state.description}
              onChange={(e) => setState((s) => ({ ...s, description: e.target.value }))}
              placeholder="Opcional"
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6 space-y-3">
        <h3 className="font-semibold">Ou começar de um template</h3>
        <div className="space-y-2">
          {templates.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => onTemplate(tpl)}
              className="w-full rounded-md border p-3 text-left hover:bg-muted transition-colors"
            >
              <p className="font-medium text-sm">{tpl.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{tpl.description}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          disabled={!state.name}
          onClick={onNext}
          className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"
        >
          Próximo <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

function Step2({ state, setState, onBack, onNext }: {
  state: WizardState
  setState: React.Dispatch<React.SetStateAction<WizardState>>
  onBack: () => void
  onNext: () => void
}) {
  const addCondition = () => {
    if (state.conditions.length >= 3) return
    setState((s) => ({ ...s, conditions: [...s.conditions, defaultCondition()] }))
  }

  const removeCondition = (i: number) => {
    setState((s) => ({ ...s, conditions: s.conditions.filter((_, idx) => idx !== i) }))
  }

  const updateCondition = (i: number, patch: Partial<AlertCondition>) => {
    setState((s) => ({
      ...s,
      conditions: s.conditions.map((c, idx) => idx === i ? { ...c, ...patch } : c),
    }))
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Condições</h3>
          {state.conditions.length > 1 && (
            <select
              value={state.operator}
              onChange={(e) => setState((s) => ({ ...s, operator: e.target.value as 'AND' | 'OR' }))}
              className="rounded-md border bg-background px-2 py-1 text-sm"
            >
              <option value="AND">Todas (AND)</option>
              <option value="OR">Qualquer (OR)</option>
            </select>
          )}
        </div>

        {state.conditions.map((cond, i) => (
          <div key={i} className="flex gap-2 items-center flex-wrap">
            <select
              value={cond.metric}
              onChange={(e) => updateCondition(i, { metric: e.target.value as AlertCondition['metric'] })}
              className="rounded-md border bg-background px-2 py-1.5 text-sm"
            >
              {METRICS.map((m) => <option key={m} value={m}>{METRIC_LABELS[m]}</option>)}
            </select>
            <select
              value={cond.comparator}
              onChange={(e) => updateCondition(i, { comparator: e.target.value as AlertCondition['comparator'] })}
              className="rounded-md border bg-background px-2 py-1.5 text-sm"
            >
              {COMPARATORS.map((c) => <option key={c} value={c}>{COMPARATOR_LABELS[c]}</option>)}
            </select>
            <input
              type="number"
              value={cond.value}
              onChange={(e) => updateCondition(i, { value: parseFloat(e.target.value) })}
              className="w-24 rounded-md border bg-background px-2 py-1.5 text-sm"
            />
            <select
              value={cond.period}
              onChange={(e) => updateCondition(i, { period: e.target.value as AlertCondition['period'] })}
              className="rounded-md border bg-background px-2 py-1.5 text-sm"
            >
              {PERIODS.map((p) => <option key={p} value={p}>{PERIOD_LABELS[p]}</option>)}
            </select>
            {state.conditions.length > 1 && (
              <button onClick={() => removeCondition(i)} className="rounded-md p-1.5 text-destructive hover:bg-destructive/10">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}

        {state.conditions.length < 3 && (
          <button onClick={addCondition} className="flex items-center gap-1 text-sm text-primary hover:underline">
            <Plus className="h-4 w-4" /> Adicionar condição
          </button>
        )}
      </div>

      <div className="flex justify-between">
        <button onClick={onBack} className="rounded-md border px-4 py-2 text-sm hover:bg-muted">Voltar</button>
        <button onClick={onNext} className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Próximo <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

function Step3({ state, setState, onBack, onNext }: {
  state: WizardState
  setState: React.Dispatch<React.SetStateAction<WizardState>>
  onBack: () => void
  onNext: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <h3 className="font-semibold">Canais e Cooldown</h3>
        <div className="space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={state.channels.dashboard}
              onChange={(e) => setState((s) => ({ ...s, channels: { ...s.channels, dashboard: e.target.checked } }))}
              className="h-4 w-4"
            />
            <span className="text-sm">Dashboard (badge no sino)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!!state.channels.email}
              onChange={(e) => setState((s) => ({ ...s, channels: { ...s.channels, email: e.target.checked } }))}
              className="h-4 w-4"
            />
            <span className="text-sm">Email (via Resend)</span>
          </label>
          {state.channels.email && (
            <div className="ml-6">
              <label className="text-sm font-medium">E-mail para notificação *</label>
              <input
                type="email"
                value={state.notifyEmail}
                onChange={(e) => setState((s) => ({ ...s, notifyEmail: e.target.value }))}
                placeholder="nome@empresa.com"
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
          )}
        </div>
        <div>
          <label className="text-sm font-medium">Cooldown entre disparos</label>
          <select
            value={state.cooldownMinutes}
            onChange={(e) => setState((s) => ({ ...s, cooldownMinutes: parseInt(e.target.value, 10) }))}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value={30}>30 minutos</option>
            <option value={60}>1 hora</option>
            <option value={360}>6 horas</option>
            <option value={720}>12 horas</option>
            <option value={1440}>24 horas</option>
          </select>
        </div>
      </div>

      <div className="flex justify-between">
        <button onClick={onBack} className="rounded-md border px-4 py-2 text-sm hover:bg-muted">Voltar</button>
        <button onClick={onNext} className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Revisar <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

function Step4({ state, onBack, onSubmit, isPending }: {
  state: WizardState
  onBack: () => void
  onSubmit: () => void
  isPending: boolean
}) {
  const METRIC_LABELS: Record<string, string> = { spend: 'Spend', ctr: 'CTR', cpm: 'CPM', frequency: 'Frequência', cpa: 'CPA', roas: 'ROAS' }
  const COMP: Record<string, string> = { gt: '>', gte: '≥', lt: '<', lte: '≤', eq: '=', change_pct: 'variação %' }
  const PER: Record<string, string> = { '1d': '1 dia', '3d': '3 dias', '7d': '7 dias', '14d': '14 dias', '30d': '30 dias' }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <h3 className="font-semibold">Revisão</h3>
        <div className="text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Nome</span>
            <span className="font-medium">{state.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Condições</span>
            <span className="font-medium text-right max-w-xs">
              {state.conditions.map((c, i) => (
                <span key={i} className="block">
                  {METRIC_LABELS[c.metric]} {COMP[c.comparator]} {c.value} ({PER[c.period]})
                </span>
              ))}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Operador</span>
            <span className="font-medium">{state.operator}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Canais</span>
            <span className="font-medium">
              {[state.channels.dashboard && 'Dashboard', state.channels.email && 'Email'].filter(Boolean).join(', ')}
            </span>
          </div>
          {state.channels.email && state.notifyEmail && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">E-mail</span>
              <span className="font-medium">{state.notifyEmail}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Cooldown</span>
            <span className="font-medium">{state.cooldownMinutes}min</span>
          </div>
        </div>
      </div>

      <div className="flex justify-between">
        <button onClick={onBack} className="rounded-md border px-4 py-2 text-sm hover:bg-muted">Voltar</button>
        <button
          onClick={onSubmit}
          disabled={isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {isPending ? 'Criando...' : 'Criar alerta'}
        </button>
      </div>
    </div>
  )
}
