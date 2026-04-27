'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, AlertTriangle, RotateCcw } from 'lucide-react'
import { ConfirmDialog } from './confirm-dialog'
import { updateCampaignStatus, updateAdSetStatus } from '@/lib/campaigns'

type EntityType = 'CAMPAIGN' | 'ADSET'

type Props = {
  entityType: EntityType
  entityId: string
  clientId: string
  currentStatus: string
  token: string
  onSuccess?: () => void
}

export function StatusToggle({ entityType, entityId, clientId, currentStatus, token, onSuccess }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const isActive = currentStatus === 'ACTIVE'
  const isPaused = currentStatus === 'PAUSED'

  const mutation = useMutation({
    mutationFn: (status: string) => {
      const key = crypto.randomUUID()
      if (entityType === 'CAMPAIGN') {
        return updateCampaignStatus(clientId, entityId, status, token, key)
      }
      return updateAdSetStatus(clientId, entityId, status, token, key)
    },
    onSuccess: (_data, status) => {
      toast.success(status === 'PAUSED' ? 'Campanha pausada' : 'Campanha ativada')
      queryClient.invalidateQueries({ queryKey: ['campaigns', clientId] })
      queryClient.invalidateQueries({ queryKey: ['campaign', entityId] })
      setPendingStatus(null)
      onSuccess?.()
    },
    onError: (err: Error) => {
      toast.error('Falha na sincronização com Meta Ads', { description: err.message })
    },
  })

  if (!isActive && !isPaused) return null

  const handleClick = (targetStatus: string) => {
    setPendingStatus(targetStatus)
    if (targetStatus === 'PAUSED') {
      setConfirmOpen(true)
    } else {
      mutation.mutate('ACTIVE')
    }
  }

  // Desync flag: mutation failed — last attempted change didn't go through
  if (mutation.isError) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-md bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 dark:bg-red-900/20 dark:text-red-400">
        <AlertTriangle className="h-3 w-3 shrink-0" />
        <span>Dessincronizado</span>
        <button
          onClick={() => {
            mutation.reset()
            if (pendingStatus) mutation.mutate(pendingStatus)
          }}
          title="Tentar novamente"
          className="ml-1 rounded p-0.5 hover:bg-red-100 dark:hover:bg-red-900/40"
        >
          <RotateCcw className="h-3 w-3" />
        </button>
      </div>
    )
  }

  return (
    <>
      <button
        onClick={() => handleClick(isActive ? 'PAUSED' : 'ACTIVE')}
        disabled={mutation.isPending}
        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
          isActive
            ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400'
            : 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400'
        }`}
      >
        {mutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
        {isActive ? 'Pausar' : 'Ativar'}
      </button>

      <ConfirmDialog
        open={confirmOpen}
        title="Pausar campanha"
        description="Isso vai interromper a veiculação imediatamente. Tem certeza?"
        confirmLabel="Pausar"
        danger
        loading={mutation.isPending}
        onConfirm={() => {
          setConfirmOpen(false)
          mutation.mutate('PAUSED')
        }}
        onCancel={() => {
          setConfirmOpen(false)
          setPendingStatus(null)
        }}
      />
    </>
  )
}
