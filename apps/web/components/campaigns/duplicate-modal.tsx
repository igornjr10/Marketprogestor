'use client'

import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { X, ChevronRight, ChevronLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { duplicateCampaign } from '@/lib/campaigns'

type Props = {
  clientId: string
  campaignId: string
  campaignName: string
  token: string
  open: boolean
  onClose: () => void
}

type WizardData = {
  name: string
  dailyBudget: string
  includeCreatives: boolean
}

export function DuplicateModal({ clientId, campaignId, campaignName, token, open, onClose }: Props) {
  const [step, setStep] = useState(1)
  const [data, setData] = useState<WizardData>({ name: `${campaignName} (cópia)`, dailyBudget: '', includeCreatives: false })
  const router = useRouter()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: () =>
      duplicateCampaign(clientId, campaignId, {
        name: data.name,
        ...(data.dailyBudget ? { dailyBudget: Math.round(parseFloat(data.dailyBudget) * 100) } : {}),
        includeCreatives: data.includeCreatives,
      }, token),
    onSuccess: (campaign) => {
      toast.success('Campanha duplicada com sucesso')
      queryClient.invalidateQueries({ queryKey: ['campaigns', clientId] })
      onClose()
      router.push(`/clients/${clientId}/campaigns/${campaign.id}`)
    },
    onError: (err: Error) => {
      toast.error('Erro ao duplicar campanha', { description: err.message })
    },
  })

  const handleClose = () => {
    setStep(1)
    setData({ name: `${campaignName} (cópia)`, dailyBudget: '', includeCreatives: false })
    onClose()
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl dark:bg-zinc-900">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Duplicar campanha <span className="text-sm font-normal text-zinc-500">(Passo {step}/3)</span>
            </Dialog.Title>
            <Dialog.Close asChild>
              <button onClick={handleClose} className="text-zinc-400 hover:text-zinc-600">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-4">
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Nome da nova campanha</label>
                  <input
                    type="text"
                    value={data.name}
                    onChange={(e) => setData((d) => ({ ...d, name: e.target.value }))}
                    className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Orçamento diário diferente (R$) — opcional
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={data.dailyBudget}
                    onChange={(e) => setData((d) => ({ ...d, dailyBudget: e.target.value }))}
                    className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
                    placeholder="Deixe vazio para manter o original"
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                  Deseja copiar os conjuntos de anúncios e criativos da campanha original?
                </p>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
                  <input
                    type="checkbox"
                    checked={data.includeCreatives}
                    onChange={(e) => setData((d) => ({ ...d, includeCreatives: e.target.checked }))}
                    className="h-4 w-4 rounded border-zinc-300 text-indigo-600"
                  />
                  <div>
                    <p className="font-medium text-zinc-800 dark:text-zinc-200">Replicar criativos e conjuntos</p>
                    <p className="text-xs text-zinc-500">Copia todos os Ad Sets e Ads vinculados</p>
                  </div>
                </label>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Resumo</p>
                <div className="rounded-lg bg-zinc-50 p-4 text-sm space-y-2 dark:bg-zinc-800">
                  <p><span className="text-zinc-500">Nome:</span> {data.name}</p>
                  <p><span className="text-zinc-500">Orçamento:</span> {data.dailyBudget ? `R$ ${parseFloat(data.dailyBudget).toFixed(2)}/dia` : 'Igual ao original'}</p>
                  <p><span className="text-zinc-500">Criativos:</span> {data.includeCreatives ? 'Sim, replicar' : 'Não'}</p>
                  <p><span className="text-zinc-500">Status inicial:</span> PAUSADA</p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 1}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50 disabled:invisible dark:border-zinc-700 dark:text-zinc-400"
            >
              <ChevronLeft className="h-4 w-4" /> Anterior
            </button>

            {step < 3 ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                disabled={step === 1 && !data.name.trim()}
                className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                Próximo <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {mutation.isPending ? 'Duplicando...' : 'Confirmar e Duplicar'}
              </button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
