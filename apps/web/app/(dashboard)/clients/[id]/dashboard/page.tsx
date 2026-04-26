'use client'

import { useQuery } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useState, useMemo } from 'react'
import { ArrowLeft, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { useAuthStore } from '@/store/auth.store'
import { getOverview, getTimeSeries, getCampaignsWithMetrics } from '@/lib/campaigns'
import type { CampaignWithMetrics } from '@marketproads/types'

// ─── Formatters ─────────────────────────────────────────────────────────────

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const fmtNumber = (v: number) => new Intl.NumberFormat('pt-BR').format(v)

const fmtPercent = (v: number) => `${v.toFixed(2)}%`

// ─── Period options ──────────────────────────────────────────────────────────

const PERIODS = [
  { label: 'Hoje', value: 1 },
  { label: '7d', value: 7 },
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
]

// ─── Metric definitions ──────────────────────────────────────────────────────

type MetricKey = 'spend' | 'impressions' | 'clicks' | 'ctr' | 'cpm' | 'cpc'

const METRICS: { key: MetricKey; label: string; format: (v: number) => string; color: string }[] = [
  { key: 'spend', label: 'Investimento', format: fmtCurrency, color: '#3b82f6' },
  { key: 'impressions', label: 'Impressões', format: fmtNumber, color: '#8b5cf6' },
  { key: 'clicks', label: 'Cliques', format: fmtNumber, color: '#10b981' },
  { key: 'ctr', label: 'CTR', format: fmtPercent, color: '#f59e0b' },
  { key: 'cpm', label: 'CPM', format: fmtCurrency, color: '#ef4444' },
  { key: 'cpc', label: 'CPC', format: fmtCurrency, color: '#06b6d4' },
]

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-500/10 text-green-600',
  PAUSED: 'bg-yellow-500/10 text-yellow-600',
  DELETED: 'bg-red-500/10 text-red-600',
  ARCHIVED: 'bg-gray-500/10 text-gray-500',
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  delta,
  isLoading,
}: {
  label: string
  value: string
  delta: number | null | undefined
  isLoading: boolean
}) {
  const hasDelta = delta !== null && delta !== undefined
  const positive = (delta ?? 0) >= 0

  return (
    <div className="rounded-lg border bg-card p-4 space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      {isLoading ? (
        <div className="h-7 w-24 rounded bg-muted animate-pulse" />
      ) : (
        <p className="text-xl font-semibold">{value}</p>
      )}
      {hasDelta && !isLoading && (
        <div className={`flex items-center gap-1 text-xs font-medium ${positive ? 'text-green-600' : 'text-red-500'}`}>
          {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {positive ? '+' : ''}{delta!.toFixed(1)}% vs período anterior
        </div>
      )}
      {!hasDelta && !isLoading && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Minus className="h-3 w-3" /> sem comparação
        </div>
      )}
    </div>
  )
}

function PeriodSelector({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {PERIODS.map((p) => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            value === p.value
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-muted text-muted-foreground'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}

function MetricToggle({
  options,
  selected,
  onChange,
}: {
  options: typeof METRICS
  selected: MetricKey
  onChange: (k: MetricKey) => void
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((m) => (
        <button
          key={m.key}
          onClick={() => onChange(m.key)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            selected === m.key
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-muted text-muted-foreground border'
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}

type SortKey = 'spend' | 'impressions' | 'clicks' | 'ctr' | 'cpm' | 'cpc'
type SortDir = 'asc' | 'desc'

function CampaignMetricsTable({
  campaigns,
  sortKey,
  sortDir,
  onSort,
  isLoading,
}: {
  campaigns: CampaignWithMetrics[]
  sortKey: SortKey
  sortDir: SortDir
  onSort: (key: SortKey) => void
  isLoading: boolean
}) {
  const cols: { key: SortKey; label: string; fmt: (v: number) => string }[] = [
    { key: 'spend', label: 'Investimento', fmt: fmtCurrency },
    { key: 'impressions', label: 'Impressões', fmt: fmtNumber },
    { key: 'clicks', label: 'Cliques', fmt: fmtNumber },
    { key: 'ctr', label: 'CTR', fmt: fmtPercent },
    { key: 'cpm', label: 'CPM', fmt: fmtCurrency },
    { key: 'cpc', label: 'CPC', fmt: fmtCurrency },
  ]

  const ThButton = ({ col }: { col: typeof cols[0] }) => (
    <th
      className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none whitespace-nowrap"
      onClick={() => onSort(col.key)}
    >
      {col.label} {sortKey === col.key ? (sortDir === 'desc' ? '↓' : '↑') : ''}
    </th>
  )

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Status</th>
            <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Campanha</th>
            {cols.map((c) => <ThButton key={c.key} col={c} />)}
          </tr>
        </thead>
        <tbody className="divide-y">
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={8} className="px-3 py-3">
                    <div className="h-4 rounded bg-muted animate-pulse" />
                  </td>
                </tr>
              ))
            : campaigns.map((c) => (
                <tr key={c.id} className="hover:bg-muted/50">
                  <td className="px-3 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[c.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 max-w-[200px] truncate font-medium">{c.name}</td>
                  {cols.map((col) => (
                    <td key={col.key} className="px-3 py-2.5 text-right tabular-nums">
                      {col.fmt(c.metrics[col.key])}
                    </td>
                  ))}
                </tr>
              ))}
          {!isLoading && campaigns.length === 0 && (
            <tr>
              <td colSpan={8} className="px-3 py-8 text-center text-sm text-muted-foreground">
                Nenhuma campanha encontrada para o período selecionado.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { id: clientId } = useParams<{ id: string }>()
  const accessToken = useAuthStore((s) => s.accessToken)

  const [period, setPeriod] = useState(30)
  const [chartMetric, setChartMetric] = useState<MetricKey>('spend')
  const [statusFilter, setStatusFilter] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('spend')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(1)

  const enabled = !!accessToken && !!clientId

  const { data: overview, isLoading: loadingOverview } = useQuery({
    queryKey: ['overview', clientId, period],
    queryFn: () => getOverview(clientId, accessToken ?? '', period, true),
    enabled,
    staleTime: 5 * 60 * 1000,
  })

  const { data: timeSeries, isLoading: loadingChart } = useQuery({
    queryKey: ['time-series', clientId, period, chartMetric],
    queryFn: () => getTimeSeries(clientId, accessToken ?? '', period, 'day', [chartMetric]),
    enabled,
    staleTime: 5 * 60 * 1000,
  })

  const sort = `${sortKey}:${sortDir}`
  const { data: campaignMetrics, isLoading: loadingCampaigns } = useQuery({
    queryKey: ['campaigns-metrics', clientId, period, statusFilter, sort, page],
    queryFn: () =>
      getCampaignsWithMetrics(clientId, accessToken ?? '', {
        period,
        status: statusFilter || undefined,
        sort,
        page,
        limit: 20,
      }),
    enabled,
    staleTime: 5 * 60 * 1000,
  })

  const activeMetric = useMemo(() => METRICS.find((m) => m.key === chartMetric)!, [chartMetric])

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
    setPage(1)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/clients/${clientId}`} className="rounded-md p-1 hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
            <p className="text-sm text-muted-foreground">Métricas de performance do cliente</p>
          </div>
        </div>
        <PeriodSelector value={period} onChange={(v) => { setPeriod(v); setPage(1) }} />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {METRICS.map((m) => (
          <KpiCard
            key={m.key}
            label={m.label}
            value={overview ? m.format(overview.current[m.key]) : '—'}
            delta={overview?.deltas?.[m.key] ?? null}
            isLoading={loadingOverview}
          />
        ))}
      </div>

      {/* Chart */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h3 className="font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Evolução no período
          </h3>
          <MetricToggle options={METRICS} selected={chartMetric} onChange={setChartMetric} />
        </div>

        {loadingChart ? (
          <div className="h-48 w-full rounded bg-muted animate-pulse" />
        ) : timeSeries && timeSeries.length > 0 ? (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeSeries} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(d: string) => d.slice(5)}
                />
                <YAxis tick={{ fontSize: 11 }} width={60} tickFormatter={(v: number) => {
                  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`
                  return String(v)
                }} />
                <Tooltip
                  formatter={(value) => [activeMetric.format(Number(value)), activeMetric.label]}
                  labelFormatter={(label) => `Data: ${String(label)}`}
                />
                <Line
                  type="monotone"
                  dataKey={chartMetric}
                  stroke={activeMetric.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Nenhum dado disponível para o período. Aguarde a primeira sincronização.
          </p>
        )}
      </div>

      {/* Campaign Table */}
      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3 flex-wrap gap-2">
          <h3 className="font-semibold">
            Campanhas
            {campaignMetrics && (
              <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                ({campaignMetrics.pagination.total})
              </span>
            )}
          </h3>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
            className="rounded-md border bg-background px-2 py-1 text-sm"
          >
            <option value="">Todos os status</option>
            <option value="ACTIVE">Ativas</option>
            <option value="PAUSED">Pausadas</option>
            <option value="ARCHIVED">Arquivadas</option>
          </select>
        </div>

        <CampaignMetricsTable
          campaigns={campaignMetrics?.campaigns ?? []}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          isLoading={loadingCampaigns}
        />

        {campaignMetrics && campaignMetrics.pagination.pages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
            <p className="text-muted-foreground">
              Página {campaignMetrics.pagination.page} de {campaignMetrics.pagination.pages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-md border px-3 py-1 text-sm hover:bg-muted disabled:opacity-50"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= campaignMetrics.pagination.pages}
                className="rounded-md border px-3 py-1 text-sm hover:bg-muted disabled:opacity-50"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
