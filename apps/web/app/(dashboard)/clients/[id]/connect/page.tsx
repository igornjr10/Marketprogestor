'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Check } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { finalizeMetaConnection } from '@/lib/clients'
import type { MetaCallbackResult } from '@marketproads/types'

export default function ConnectMetaPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const accessToken = useAuthStore((s) => s.accessToken)
  const [data, setData] = useState<MetaCallbackResult | null>(null)
  const [selectedBizId, setSelectedBizId] = useState<string | null>(null)
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const raw = sessionStorage.getItem(`meta_callback_${id}`)
    if (!raw) {
      router.replace(`/clients/${id}`)
      return
    }
    try {
      setData(JSON.parse(raw) as MetaCallbackResult)
    } catch {
      router.replace(`/clients/${id}`)
    }
  }, [id, router])

  if (!data) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  const selectedBiz = data.businesses.find((b) => b.id === selectedBizId)
  const availableAccounts = selectedBizId ? (data.adAccounts[selectedBizId] ?? []) : []

  function toggleAccount(accountId: string) {
    setSelectedAccountIds((prev) =>
      prev.includes(accountId) ? prev.filter((a) => a !== accountId) : [...prev, accountId],
    )
  }

  async function handleFinalize() {
    if (!selectedBizId || selectedAccountIds.length === 0 || !data || !selectedBiz) return
    setIsSubmitting(true)
    setError(null)
    try {
      await finalizeMetaConnection(
        id,
        {
          businessId: selectedBizId,
          businessName: selectedBiz.name,
          adAccountIds: selectedAccountIds,
          tokenData: data.tokenData,
        },
        accessToken ?? '',
      )
      sessionStorage.removeItem(`meta_callback_${id}`)
      router.push(`/clients/${id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao finalizar conexão')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/clients/${id}`} className="rounded-md p-1 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Conectar Meta Ads</h2>
          <p className="text-muted-foreground">
            Selecione o Business Manager e as contas de anúncio.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Business Manager</p>
        {data.businesses.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum Business Manager encontrado.</p>
        ) : (
          <div className="space-y-2">
            {data.businesses.map((biz) => (
              <button
                key={biz.id}
                type="button"
                onClick={() => {
                  setSelectedBizId(biz.id)
                  setSelectedAccountIds([])
                }}
                className={`flex w-full items-center justify-between rounded-lg border p-3 text-left text-sm transition ${
                  selectedBizId === biz.id
                    ? 'border-primary bg-primary/5'
                    : 'hover:border-muted-foreground/30'
                }`}
              >
                <span className="font-medium">{biz.name}</span>
                {selectedBizId === biz.id && <Check className="h-4 w-4 text-primary" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedBizId && (
        <div className="space-y-2">
          <p className="text-sm font-medium">
            Contas de anúncio{' '}
            <span className="font-normal text-muted-foreground">
              ({selectedAccountIds.length} selecionada
              {selectedAccountIds.length !== 1 ? 's' : ''})
            </span>
          </p>
          {availableAccounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma conta de anúncio encontrada neste BM.
            </p>
          ) : (
            <div className="space-y-2">
              {availableAccounts.map((acc) => {
                const selected = selectedAccountIds.includes(acc.account_id)
                return (
                  <button
                    key={acc.account_id}
                    type="button"
                    onClick={() => toggleAccount(acc.account_id)}
                    className={`flex w-full items-center justify-between rounded-lg border p-3 text-left text-sm transition ${
                      selected
                        ? 'border-primary bg-primary/5'
                        : 'hover:border-muted-foreground/30'
                    }`}
                  >
                    <div>
                      <p className="font-medium">{acc.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {acc.account_id} · {acc.currency} · {acc.timezone_name}
                      </p>
                    </div>
                    {selected && <Check className="h-4 w-4 text-primary" />}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleFinalize}
          disabled={!selectedBizId || selectedAccountIds.length === 0 || isSubmitting}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {isSubmitting ? 'Salvando...' : 'Finalizar conexão'}
        </button>
        <Link
          href={`/clients/${id}`}
          className="rounded-md border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
        >
          Cancelar
        </Link>
      </div>
    </div>
  )
}
