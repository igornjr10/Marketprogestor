'use client'

import { useQuery } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'
import { ArrowLeft, ChevronDown, ChevronRight, Pencil, Copy, History } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { getCampaign } from '@/lib/campaigns'
import { StatusToggle } from '@/components/campaigns/status-toggle'
import { BudgetModal } from '@/components/campaigns/budget-modal'
import { DuplicateModal } from '@/components/campaigns/duplicate-modal'
import { AuditLogPanel } from '@/components/campaigns/audit-log-panel'
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
  const accessToken = useAuthStore((s) => s.accessToken) ?? ''
  const [budgetOpen, setBudgetOpen] = useState(false)
  const [dupOpen, setDupOpen] = useState(false)

  const { data: campaign, isLoading } = useQuery({
    queryKey: ['campaign', clientId, campaignId],
    queryFn: () => getCampaign(clientId, campaignId, accessToken),
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
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight truncate">{campaign.name}</h2>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[campaign.status] ?? 'bg-gray-100 text-gray-600'}`}>
              {campaign.status}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{campaign.objective}</p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <StatusToggle
            entityType="CAMPAIGN"
            entityId={campaign.id}
            clientId={clientId}
            currentStatus={campaign.status}
            token={accessToken}
          />
          <button
            onClick={() => setBudgetOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300"
          >
            <Pencil className="h-3 w-3" /> Orçamento
          </button>
          <button
            onClick={() => setDupOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300"
          >
            <Copy className="h-3 w-3" /> Duplicar
          </button>
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
              <AdSetRow key={adSet.id} adSet={adSet} clientId={clientId} campaignId={campaignId} token={accessToken} />
            ))}
          </div>
        )}
      </div>

      {/* Audit Log */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="font-semibold flex items-center gap-2 mb-4">
          <History className="h-4 w-4" /> Histórico de alterações
        </h3>
        <AuditLogPanel
          clientId={clientId}
          token={accessToken}
          entityId={campaign.id}
          entityType="CAMPAIGN"
        />
      </div>

      <BudgetModal
        entity={campaign}
        clientId={clientId}
        campaignId={campaign.id}
        token={accessToken}
        open={budgetOpen}
        onClose={() => setBudgetOpen(false)}
      />
      <DuplicateModal
        clientId={clientId}
        campaignId={campaign.id}
        campaignName={campaign.name}
        token={accessToken}
        open={dupOpen}
        onClose={() => setDupOpen(false)}
      />
    </div>
  )
}

function AdSetRow({ adSet, clientId, campaignId, token }: { adSet: AdSet & { ads: Ad[] }; clientId: string; campaignId: string; token: string }) {
  const [expanded, setExpanded] = useState(false)
  const [budgetOpen, setBudgetOpen] = useState(false)

  return (
    <div>
      <div className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <div className="min-w-0">
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
        </button>

        <div className="flex items-center gap-2 shrink-0">
          <StatusToggle
            entityType="ADSET"
            entityId={adSet.id}
            clientId={clientId}
            currentStatus={adSet.status}
            token={token}
          />
          <button
            onClick={() => setBudgetOpen(true)}
            title="Editar orçamento"
            className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

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

      <BudgetModal
        entity={{ id: adSet.id, name: adSet.name, dailyBudget: adSet.dailyBudget, lifetimeBudget: adSet.lifetimeBudget }}
        clientId={clientId}
        campaignId={campaignId}
        adSetId={adSet.id}
        token={token}
        open={budgetOpen}
        onClose={() => setBudgetOpen(false)}
      />
    </div>
  )
}
