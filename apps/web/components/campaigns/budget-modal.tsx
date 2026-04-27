'use client'

import { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { X, AlertTriangle } from 'lucide-react'
import { updateCampaignBudget, updateAdSetBudget, dryRunCampaign } from '@/lib/campaigns'
import type { DryRunImpact } from '@marketproads/types'

type Entity = {
  id: string
  name: string
  dailyBudget: number | null
  lifetimeBudget: number | null
}

type Props = {
  entity: Entity
  clientId: string
  campaignId: string
  adSetId?: string
  token: string
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function BudgetModal({ entity, clientId, campaignId, adSetId, token, open, onClose, onSuccess }: Props) {
  const [budgetType, setBudgetType] = useState<'DAILY' | 'LIFETIME'>('DAILY')
  const [value, setValue] = useState('')
  const [impacts, setImpacts] = useState<DryRunImpact[]>([])
  const [confirmed, setConfirmed] = useState(false)
  const queryClient = useQueryClient()

  const currentBudget = budgetType === 'DAILY' ? entity.dailyBudget : entity.lifetimeBudget
  const numValue = parseFloat(value) * 100 // convert reais to centavos

  useEffect(() => {
    setImpacts([])
    setConfirmed(false)
  }, [open, budgetType])

  const checkDryRun = async (rawValue: string) => {
    const num = parseFloat(rawValue)
    if (isNaN(num) || num <= 0) return setImpacts([])
    const centavos = Math.round(num * 100)
    const changes = budgetType === 'DAILY' ? { dailyBudget: centavos } : { lifetimeBudget: centavos }
    try {
      const result = await dryRunCampaign(clientId, campaignId, changes, token)
      setImpacts(result.impacts)
    } catch {
      setImpacts([])
    }
  }

  const significantImpact = impacts.find((i) => i.type === 'BUDGET_SIGNIFICANT_CHANGE')
  const needsConfirmation = significantImpact?.requiresConfirmation ?? false
  const canSubmit = !needsConfirmation || confirmed

  const mutation = useMutation({
    mutationFn: () => {
      const centavos = Math.round(numValue)
      const budget = budgetType === 'DAILY' ? { dailyBudget: centavos } : { lifetimeBudget: centavos }
      if (adSetId) return updateAdSetBudget(clientId, adSetId, budget, token, crypto.randomUUID())
      return updateCampaignBudget(clientId, campaignId, budget, token, crypto.randomUUID())
    },
    onSuccess: () => {
      toast.success('Orçamento atualizado')
      queryClient.invalidateQueries({ queryKey: ['campaigns', clientId] })
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] })
      onSuccess?.()
      onClose()
    },
    onError: (err: Error) => {
      toast.error('Erro ao atualizar orçamento', { description: err.message })
    },
  })

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl dark:bg-zinc-900">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Editar orçamento — {entity.name}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="text-zinc-400 hover:text-zinc-600">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-4 space-y-4">
            <div className="flex rounded-md border border-zinc-200 dark:border-zinc-700">
              {(['DAILY', 'LIFETIME'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setBudgetType(t)}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    budgetType === t
                      ? 'bg-indigo-600 text-white'
                      : 'text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400'
                  }`}
                >
                  {t === 'DAILY' ? 'Diário' : 'Vitalício'}
                </button>
              ))}
            </div>

            {currentBudget !== null && (
              <p className="text-sm text-zinc-500">
                Atual: R$ {(currentBudget / 100).toFixed(2)}
              </p>
            )}

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Novo valor (R$)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value)
                  checkDryRun(e.target.value)
                }}
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
                placeholder="0.00"
              />
            </div>

            {significantImpact && (
              <div className="rounded-md bg-red-50 p-3 dark:bg-red-900/20">
                <div className="flex gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
                  <p className="text-sm text-red-700 dark:text-red-400">{significantImpact.message}</p>
                </div>
                <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-red-700 dark:text-red-400">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                    className="rounded border-red-300"
                  />
                  Entendo e quero confirmar esta mudança
                </label>
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={mutation.isPending}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
            >
              Cancelar
            </button>
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || !value || parseFloat(value) <= 0 || !canSubmit}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {mutation.isPending ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
