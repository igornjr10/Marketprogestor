'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
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
  const queryClient = useQueryClient()

  const isPausing = currentStatus === 'ACTIVE'
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
    onSuccess: () => {
      toast.success(isPausing ? 'Campanha pausada' : 'Campanha ativada')
      queryClient.invalidateQueries({ queryKey: ['campaigns', clientId] })
      queryClient.invalidateQueries({ queryKey: ['campaign', entityId] })
      onSuccess?.()
    },
    onError: (err: Error) => {
      toast.error('Erro ao atualizar status', { description: err.message })
    },
  })

  if (!isActive && !isPaused) return null

  const handleClick = () => {
    if (isPausing) {
      setConfirmOpen(true)
    } else {
      mutation.mutate('ACTIVE')
    }
  }

  return (
    <>
      <button
        onClick={handleClick}
        disabled={mutation.isPending}
        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
          isActive
            ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400'
            : 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400'
        }`}
      >
        {mutation.isPending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : null}
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
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  )
}
