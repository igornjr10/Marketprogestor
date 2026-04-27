'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Image as ImageIcon, X, AlertTriangle, TrendingDown } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid,
} from 'recharts'
import { useAuthStore } from '@/store/auth.store'
import { getCreativesGallery, getCreativeTimeline } from '@/lib/creatives'
import type { CreativeCard, CreativeTimeline } from '@marketproads/types'

const FATIGUE_COLORS: Record<string, string> = {
  NONE: 'text-green-700 bg-green-100',
  MODERATE: 'text-yellow-700 bg-yellow-100',
  SEVERE: 'text-red-700 bg-red-100',
}

const FATIGUE_BORDER: Record<string, string> = {
  NONE: 'border-l-green-400',
  MODERATE: 'border-l-yellow-400',
  SEVERE: 'border-l-red-400',
}

const FATIGUE_LINE: Record<string, string> = {
  NONE: '#22c55e',
  MODERATE: '#eab308',
  SEVERE: '#ef4444',
}

const FATIGUE_LABELS: Record<string, string> = {
  NONE: 'Saudável',
  MODERATE: 'Moderada',
  SEVERE: 'Severa',
}

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

export default function CreativesPage() {
  const { id: clientId } = useParams<{ id: string }>()
  const accessToken = useAuthStore((s) => s.accessToken)
  const [period, setPeriod] = useState(30)
  const [sort, setSort] = useState('spend:desc')
  const [fatigueFilter, setFatigueFilter] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<CreativeCard | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['creatives-gallery', clientId, period, sort, fatigueFilter, page],
    queryFn: () => getCreativesGallery(clientId, accessToken ?? '', { period, sort, fatigue: fatigueFilter || undefined, page, limit: 20 }),
    enabled: !!accessToken && !!clientId,
    staleTime: 5 * 60 * 1000,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/clients/${clientId}`} className="rounded-md p-1 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Criativos</h2>
          <p className="text-sm text-muted-foreground">Galeria de anúncios com análise de fadiga criativa</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          value={period}
          onChange={(e) => { setPeriod(Number(e.target.value)); setPage(1) }}
          className="rounded-md border bg-background px-3 py-1.5 text-sm"
        >
          <option value={7}>Últimos 7 dias</option>
          <option value={30}>Últimos 30 dias</option>
          <option value={60}>Últimos 60 dias</option>
        </select>

        <select
          value={fatigueFilter}
          onChange={(e) => { setFatigueFilter(e.target.value); setPage(1) }}
          className="rounded-md border bg-background px-3 py-1.5 text-sm"
        >
          <option value="">Todas as fadigas</option>
          <option value="NONE">Saudável</option>
          <option value="MODERATE">Moderada</option>
          <option value="SEVERE">Severa</option>
        </select>

        <select
          value={sort}
          onChange={(e) => { setSort(e.target.value); setPage(1) }}
          className="rounded-md border bg-background px-3 py-1.5 text-sm"
        >
          <option value="spend:desc">Maior Spend</option>
          <option value="ctr:desc">Maior CTR</option>
          <option value="frequency:desc">Maior Frequência</option>
          <option value="fatigue:asc">Por Fadiga</option>
        </select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : (data?.creatives?.length ?? 0) === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground">
          Nenhum criativo encontrado para os filtros selecionados.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data!.creatives.map((creative) => (
            <CreativeCardComponent
              key={creative.id}
              creative={creative}
              onClick={() => setSelected(creative)}
            />
          ))}
        </div>
      )}

      {data && data.pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="text-sm text-muted-foreground">
            {page} / {data.pagination.pages}
          </span>
          <button
            disabled={page === data.pagination.pages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-40"
          >
            Próxima
          </button>
        </div>
      )}

      {selected && (
        <FatigueDrawer creative={selected} clientId={clientId} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}

function CreativeCardComponent({ creative, onClick }: { creative: CreativeCard; onClick: () => void }) {
  const level = creative.fatigue.level
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border-l-4 border bg-card text-left overflow-hidden hover:shadow-md transition-shadow ${FATIGUE_BORDER[level]}`}
    >
      {creative.thumbnailUrl || creative.imageUrl ? (
        <img
          src={creative.thumbnailUrl ?? creative.imageUrl ?? undefined}
          alt={creative.name}
          loading="lazy"
          className="h-40 w-full object-cover"
        />
      ) : (
        <div className="flex h-40 items-center justify-center bg-muted">
          <ImageIcon className="h-10 w-10 text-muted-foreground" />
        </div>
      )}
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-semibold text-sm">{creative.name}</p>
            <p className="truncate text-xs text-muted-foreground">{creative.campaignName}</p>
          </div>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${FATIGUE_COLORS[level]}`}>
            {FATIGUE_LABELS[level]}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1 text-center">
          <Metric label="Spend" value={fmt.format(creative.spend)} />
          <Metric label="CTR" value={`${creative.ctr}%`} />
          <Metric label="Freq." value={String(creative.frequency)} />
          <Metric label="Imp." value={new Intl.NumberFormat('pt-BR', { notation: 'compact' }).format(creative.impressions)} />
        </div>
      </div>
    </button>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-xs font-semibold">{value}</p>
    </div>
  )
}

function FatigueDrawer({ creative, clientId, onClose }: { creative: CreativeCard; clientId: string; onClose: () => void }) {
  const accessToken = useAuthStore((s) => s.accessToken)
  const level = creative.fatigue.level

  const { data: timeline, isLoading } = useQuery<CreativeTimeline[]>({
    queryKey: ['creative-timeline', clientId, creative.adId],
    queryFn: () => getCreativeTimeline(clientId, creative.adId, accessToken ?? ''),
    enabled: !!accessToken,
  })

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-card shadow-xl overflow-y-auto">
        <div className="flex items-center justify-between border-b p-4">
          <div className="min-w-0">
            <p className="truncate font-semibold">{creative.name}</p>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${FATIGUE_COLORS[level]}`}>
              Fadiga {FATIGUE_LABELS[level]}
            </span>
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-6">
          {level !== 'NONE' && (
            <div className={`flex items-start gap-2 rounded-md px-3 py-2.5 text-sm ${FATIGUE_COLORS[level]}`}>
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">
                  {level === 'SEVERE' ? 'Fadiga Severa detectada' : 'Fadiga Moderada detectada'}
                </p>
                <p className="text-xs opacity-80 mt-0.5">
                  CTR caiu {Math.round(creative.fatigue.delta * 100)}% (de {creative.fatigue.baselineCtr}% para {creative.fatigue.currentCtr}%). Frequência média: {creative.fatigue.frequency}×
                </p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm font-semibold">CTR Diário (últimos 30 dias)</p>
            {isLoading ? (
              <div className="h-40 animate-pulse rounded-md bg-muted" />
            ) : timeline && timeline.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={timeline} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.1} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v: string) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${v}%`} />
                  <Tooltip
                    formatter={(v: unknown) => [`${v}%`, 'CTR']}
                    labelFormatter={(l: unknown) => new Date(String(l)).toLocaleDateString('pt-BR')}
                  />
                  <ReferenceLine
                    y={creative.fatigue.baselineCtr}
                    stroke={FATIGUE_LINE[level]}
                    strokeDasharray="6 3"
                    label={{ value: 'Baseline', position: 'right', fontSize: 10 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="ctr"
                    stroke={FATIGUE_LINE[level]}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground">Sem dados de série temporal.</p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold">Métricas Detalhadas</p>
            <table className="w-full text-sm">
              <tbody className="divide-y">
                {[
                  ['Spend', fmt.format(creative.spend)],
                  ['Impressões', new Intl.NumberFormat('pt-BR').format(creative.impressions)],
                  ['Cliques', new Intl.NumberFormat('pt-BR').format(creative.clicks)],
                  ['CTR', `${creative.ctr}%`],
                  ['CPM', fmt.format(creative.cpm)],
                  ['CPC', fmt.format(creative.cpc)],
                  ['Frequência', `${creative.frequency}×`],
                  ['CTR Baseline', `${creative.fatigue.baselineCtr}%`],
                  ['CTR Atual', `${creative.fatigue.currentCtr}%`],
                  ['Delta Fadiga', `${Math.round(creative.fatigue.delta * 100)}%`],
                ].map(([label, value]) => (
                  <tr key={label}>
                    <td className="py-2 text-muted-foreground">{label}</td>
                    <td className="py-2 text-right font-medium">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {(creative.body || creative.title) && (
            <div className="space-y-2">
              <p className="text-sm font-semibold">Copy</p>
              {creative.title && <p className="font-medium text-sm">{creative.title}</p>}
              {creative.body && <p className="text-sm text-muted-foreground">{creative.body}</p>}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
