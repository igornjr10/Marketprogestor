'use client'

import { useQuery } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'
import { ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { getCampaign } from '@/lib/campaigns'
import type { AdSet, Ad } from '@marketproads/types'

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-500/10 text-green-600',
  PAUSED: 'bg-yellow-500/10 text-yellow-600',
  DELETED: 'bg-red-500/10 text-red-600',
  ARCHIVED: 'bg-gray-500/10 text-gray-500',
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('pt-BR')
}

function formatBudget(value: number | null) {
  if (!value) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value / 100)
}

export default function CampaignDetailPage() {
  const { id: clientId, campaignId } = useParams<{ id: string; campaignId: string }>()
  const accessToken = useAuthStore((s) => s.accessToken)

  const { data: campaign, isLoading } = useQuery({
    queryKey: ['campaign', clientId, campaignId],
    queryFn: () => getCampaign(clientId, campaignId, accessToken ?? ''),
    enabled: !!accessToken,
  })

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>
  if (!campaign) return <p className="text-sm text-destructive">Campanha não encontrada.</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/clients/${clientId}/campaigns`} className="rounded-md p-1 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight truncate">{campaign.name}</h2>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[campaign.status] ?? 'bg-gray-100 text-gray-600'}`}>
              {campaign.status}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{campaign.objective}</p>
        </div>
      </div>

      {/* Campaign info */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="font-semibold mb-4">Detalhes da Campanha</h3>
        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-muted-foreground">Budget diário</p>
            <p className="font-medium">{formatBudget(campaign.dailyBudget)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Budget total</p>
            <p className="font-medium">{formatBudget(campaign.lifetimeBudget)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Início</p>
            <p className="font-medium">{formatDate(campaign.startTime)}</p>
          </div>
          {campaign.stopTime && (
            <div>
              <p className="text-muted-foreground">Fim</p>
              <p className="font-medium">{formatDate(campaign.stopTime)}</p>
            </div>
          )}
          {campaign.lastSyncedAt && (
            <div>
              <p className="text-muted-foreground">Última sincronização</p>
              <p className="font-medium">{new Date(campaign.lastSyncedAt).toLocaleString('pt-BR')}</p>
            </div>
          )}
          <div>
            <p className="text-muted-foreground">ID Meta</p>
            <p className="font-medium font-mono text-xs">{campaign.metaCampaignId}</p>
          </div>
        </div>
      </div>

      {/* AdSets */}
      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h3 className="font-semibold">
            Conjuntos de Anúncios{' '}
            <span className="text-muted-foreground font-normal text-sm">
              ({campaign.adSets.length})
            </span>
          </h3>
        </div>

        {campaign.adSets.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            Nenhum conjunto de anúncios encontrado.
          </p>
        ) : (
          <div className="divide-y">
            {campaign.adSets.map((adSet) => (
              <AdSetRow key={adSet.id} adSet={adSet} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function AdSetRow({ adSet }: { adSet: AdSet & { ads: Ad[] } }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm truncate">{adSet.name}</p>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[adSet.status] ?? 'bg-gray-100 text-gray-600'}`}>
              {adSet.status}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {adSet.optimizationGoal} · {adSet.ads.length} anúncio(s)
          </p>
        </div>
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="border-t bg-muted/20 px-4 py-3 space-y-2">
          <div className="grid grid-cols-3 gap-3 text-xs text-muted-foreground mb-3">
            <div>
              <span className="font-medium text-foreground">Budget diário: </span>
              {formatBudget(adSet.dailyBudget)}
            </div>
            <div>
              <span className="font-medium text-foreground">Budget total: </span>
              {formatBudget(adSet.lifetimeBudget)}
            </div>
            <div>
              <span className="font-medium text-foreground">Billing: </span>
              {adSet.billingEvent}
            </div>
          </div>

          {adSet.ads.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum anúncio neste conjunto.</p>
          ) : (
            <div className="space-y-1.5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Anúncios
              </p>
              {adSet.ads.map((ad) => (
                <div
                  key={ad.id}
                  className="flex items-center justify-between rounded-md bg-background px-3 py-2 text-sm border"
                >
                  <span className="font-medium truncate">{ad.name}</span>
                  <span className={`ml-3 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[ad.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {ad.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
