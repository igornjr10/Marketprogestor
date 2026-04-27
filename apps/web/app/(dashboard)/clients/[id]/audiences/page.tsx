'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { useAuthStore } from '@/store/auth.store'
import { getBreakdown, getHeatmap } from '@/lib/creatives'
import type { BreakdownResult, HeatmapResult } from '@marketproads/types'

const DIMENSIONS = [
  { key: 'age', label: 'Idade' },
  { key: 'gender', label: 'Gênero' },
  { key: 'device_platform', label: 'Dispositivo' },
  { key: 'publisher_platform', label: 'Plataforma' },
]

const PERIODS = [
  { value: 7, label: '7 dias' },
  { value: 30, label: '30 dias' },
  { value: 60, label: '60 dias' },
]

const fmtBrl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const fmtNum = new Intl.NumberFormat('pt-BR')

export default function AudiencesPage() {
  const { id: clientId } = useParams<{ id: string }>()
  const accessToken = useAuthStore((s) => s.accessToken)
  const [dimension, setDimension] = useState('age')
  const [period, setPeriod] = useState(30)

  const { data: breakdown, isLoading: loadingBreakdown } = useQuery<BreakdownResult>({
    queryKey: ['breakdown', clientId, dimension, period],
    queryFn: () => getBreakdown(clientId, accessToken ?? '', dimension, period),
    enabled: !!accessToken && !!clientId,
    staleTime: 5 * 60 * 1000,
  })

  const { data: heatmap, isLoading: loadingHeatmap } = useQuery<HeatmapResult>({
    queryKey: ['heatmap', clientId, 'age', 'gender', period],
    queryFn: () => getHeatmap(clientId, accessToken ?? '', 'age', 'gender', period),
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
          <h2 className="text-2xl font-bold tracking-tight">Públicos</h2>
          <p className="text-sm text-muted-foreground">Análise demográfica de desempenho por segmento</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          value={period}
          onChange={(e) => setPeriod(Number(e.target.value))}
          className="rounded-md border bg-background px-3 py-1.5 text-sm"
        >
          {PERIODS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="flex border-b">
          {DIMENSIONS.map((d) => (
            <button
              key={d.key}
              onClick={() => setDimension(d.key)}
              className={`px-4 py-3 text-sm font-medium transition-colors ${
                dimension === d.key
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        <div className="p-6 space-y-6">
          {loadingBreakdown ? (
            <div className="h-60 animate-pulse rounded-md bg-muted" />
          ) : !breakdown || breakdown.rows.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">
              Sem dados de breakdown disponíveis. Aguarde a próxima sincronização com breakdowns.
            </p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={breakdown.rows} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="currentColor" strokeOpacity={0.1} />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => fmtBrl.format(v)} />
                  <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={55} />
                  <Tooltip formatter={(v: unknown) => [fmtBrl.format(Number(v)), 'Spend']} />
                  <Bar dataKey="spend" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground text-xs">
                      <th className="pb-2 text-left font-medium">Segmento</th>
                      <th className="pb-2 text-right font-medium">Spend</th>
                      <th className="pb-2 text-right font-medium">Impressões</th>
                      <th className="pb-2 text-right font-medium">Cliques</th>
                      <th className="pb-2 text-right font-medium">CTR</th>
                      <th className="pb-2 text-right font-medium">% Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {breakdown.rows.map((row) => (
                      <tr key={row.label}>
                        <td className="py-2 font-medium">{row.label}</td>
                        <td className="py-2 text-right">{fmtBrl.format(row.spend)}</td>
                        <td className="py-2 text-right">{fmtNum.format(row.impressions)}</td>
                        <td className="py-2 text-right">{fmtNum.format(row.clicks)}</td>
                        <td className="py-2 text-right">{row.ctr}%</td>
                        <td className="py-2 text-right">{row.pct}%</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t font-semibold">
                      <td className="pt-2">Total</td>
                      <td className="pt-2 text-right">{fmtBrl.format(breakdown.totals.spend)}</td>
                      <td className="pt-2 text-right">{fmtNum.format(breakdown.totals.impressions)}</td>
                      <td className="pt-2 text-right">{fmtNum.format(breakdown.totals.clicks)}</td>
                      <td className="pt-2 text-right"></td>
                      <td className="pt-2 text-right">100%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div>
          <h3 className="font-semibold">Heatmap Idade × Gênero</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Distribuição de spend estimada por cruzamento demográfico</p>
        </div>

        {loadingHeatmap ? (
          <div className="h-40 animate-pulse rounded-md bg-muted" />
        ) : !heatmap || heatmap.cells.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem dados de heatmap disponíveis.</p>
        ) : (
          <HeatmapGrid heatmap={heatmap} />
        )}
      </div>
    </div>
  )
}

function HeatmapGrid({ heatmap }: { heatmap: HeatmapResult }) {
  const maxPct = Math.max(...heatmap.cells.map((c) => c.pct), 1)
  const fmtBrl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="p-2 text-left text-xs text-muted-foreground font-medium">Idade / Gênero</th>
            {heatmap.dim2Values.map((d2) => (
              <th key={d2} className="p-2 text-center text-xs text-muted-foreground font-medium capitalize">{d2}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {heatmap.dim1Values.map((d1) => (
            <tr key={d1}>
              <td className="p-2 text-xs font-medium text-muted-foreground whitespace-nowrap">{d1}</td>
              {heatmap.dim2Values.map((d2) => {
                const cell = heatmap.cells.find((c) => c.dim1 === d1 && c.dim2 === d2)
                const pct = cell?.pct ?? 0
                const opacity = maxPct > 0 ? pct / maxPct : 0
                return (
                  <td
                    key={d2}
                    title={`${d1} × ${d2}: ${fmtBrl.format(cell?.spend ?? 0)} (${pct}%)`}
                    className="p-1"
                  >
                    <div
                      style={{ backgroundColor: `rgba(59, 130, 246, ${opacity})` }}
                      className="rounded px-2 py-3 text-center text-xs font-medium min-w-[64px]"
                    >
                      <span className={opacity > 0.5 ? 'text-white' : 'text-foreground'}>
                        {fmtBrl.format(cell?.spend ?? 0)}
                      </span>
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <div className="h-3 w-16 rounded" style={{ background: 'linear-gradient(to right, rgba(59,130,246,0.05), rgba(59,130,246,1))' }} />
        <span>0% → 100% do spend</span>
      </div>
    </div>
  )
}
