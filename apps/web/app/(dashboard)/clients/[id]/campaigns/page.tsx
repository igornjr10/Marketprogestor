'use client'

import { useQuery } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'
import { ArrowLeft, BarChart2, RefreshCw, TrendingUp } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { getCampaigns, getClientInsights } from '@/lib/campaigns'
import type { Campaign } from '@marketproads/types'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-500/10 text-green-600',
  PAUSED: 'bg-yellow-500/10 text-yellow-600',
  DELETED: 'bg-red-500/10 text-red-600',
  ARCHIVED: 'bg-gray-500/10 text-gray-500',
}

const PERIODS = [
  { label: '7 dias', value: 7 },
  { label: '30 dias', value: 30 },
  { label: '60 dias', value: 60 },
]

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('pt-BR').format(value)
}

export default function CampaignsPage() {
  const { id: clientId } = useParams<{ id: string }>()
  const accessToken = useAuthStore((s) => s.accessToken)
  const [statusFilter, setStatusFilter] = useState('')
  const [period, setPeriod] = useState(30)
  const [page, setPage] = useState(1)

  const { data: campaignsData, isLoading: loadingCampaigns } = useQuery({
    queryKey: ['campaigns', clientId, statusFilter, page],
    queryFn: () => getCampaigns(clientId, accessToken ?? '', { status: statusFilter || undefined, page }),
    enabled: !!accessToken,
  })

  const { data: insights, isLoading: loadingInsights } = useQuery({
    queryKey: ['insights', clientId, period],
    queryFn: () => getClientInsights(clientId, accessToken ?? '', period),
    enabled: !!accessToken,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/clients/${clientId}`} className="rounded-md p-1 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Campanhas</h2>
          <p className="text-sm text-muted-foreground">
            {campaignsData ? `${campaignsData.pagination.total} campanha(s)` : 'Carregando...'}
          </p>
        </div>
      </div>

      {/* Insights Chart */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Métricas do Período
          </h3>
          <div className="flex gap-1">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  period === p.value
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted text-muted-foreground'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {loadingInsights ? (
          <p className="text-sm text-muted-foreground">Carregando métricas...</p>
        ) : insights ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MetricCard label="Investimento" value={formatCurrency(insights.totals.spend)} />
              <MetricCard label="Impressões" value={formatNumber(insights.totals.impressions)} />
              <MetricCard label="Cliques" value={formatNumber(insights.totals.clicks)} />
              <MetricCard label="CTR" value={`${insights.totals.ctr}%`} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <MetricCard label="CPM" value={formatCurrency(insights.totals.cpm)} small />
              <MetricCard label="CPC" value={formatCurrency(insights.totals.cpc)} small />
              <MetricCard label="Alcance" value={formatNumber(insights.totals.reach)} small />
            </div>

            {insights.byDate.length > 0 && (
              <div className="h-40 mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={insights.byDate}>
                    <defs>
                      <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(d) => d.slice(5)}
                    />
                    <YAxis tick={{ fontSize: 11 }} width={50} />
                    <Tooltip
                      formatter={(value: number) => [formatCurrency(value), 'Investimento']}
                      labelFormatter={(label) => `Data: ${label}`}
                    />
                    <Area
                      type="monotone"
                      dataKey="spend"
                      stroke="#3b82f6"
                      fill="url(#spendGradient)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma métrica disponível. Aguarde a primeira sincronização.</p>
        )}
      </div>

      {/* Campaigns Table */}
      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="font-semibold flex items-center gap-2">
            <BarChart2 className="h-4 w-4" /> Lista de Campanhas
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

        {loadingCampaigns ? (
          <p className="p-6 text-sm text-muted-foreground">Carregando campanhas...</p>
        ) : campaignsData?.campaigns.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhuma campanha encontrada. Aguarde a sincronização ou altere o filtro.
            </p>
          </div>
        ) : (
          <>
            <div className="divide-y">
              {campaignsData?.campaigns.map((c) => (
                <CampaignRow key={c.id} campaign={c} clientId={clientId} />
              ))}
            </div>

            {campaignsData && campaignsData.pagination.pages > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
                <p className="text-muted-foreground">
                  Página {campaignsData.pagination.page} de {campaignsData.pagination.pages}
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
                    disabled={page >= campaignsData.pagination.pages}
                    className="rounded-md border px-3 py-1 text-sm hover:bg-muted disabled:opacity-50"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function CampaignRow({ campaign, clientId }: { campaign: Campaign; clientId: string }) {
  const budget = campaign.dailyBudget ?? campaign.lifetimeBudget
  const budgetLabel = campaign.dailyBudget ? 'diário' : campaign.lifetimeBudget ? 'total' : null

  return (
    <Link
      href={`/clients/${clientId}/campaigns/${campaign.id}`}
      className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-sm">{campaign.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{campaign.objective}</p>
      </div>
      <div className="ml-4 flex items-center gap-4 text-sm shrink-0">
        {budget && (
          <span className="text-muted-foreground text-xs">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(budget / 100)}{' '}
            {budgetLabel}
          </span>
        )}
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[campaign.status] ?? 'bg-gray-100 text-gray-600'}`}
        >
          {campaign.status}
        </span>
        <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
    </Link>
  )
}

function MetricCard({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="rounded-lg bg-muted/40 p-3 space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-semibold ${small ? 'text-sm' : 'text-lg'}`}>{value}</p>
    </div>
  )
}
