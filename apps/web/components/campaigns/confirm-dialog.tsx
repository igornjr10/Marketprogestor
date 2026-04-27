'use client'

import * as Dialog from '@radix-ui/react-dialog'

type Props = {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
  title: string
  description: string
  confirmLabel?: string
  danger?: boolean
  loading?: boolean
}

export function ConfirmDialog({ open, onConfirm, onCancel, title, description, confirmLabel = 'Confirmar', danger, loading }: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) onCancel() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl dark:bg-zinc-900">
          <Dialog.Title className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {title}
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {description}
          </Dialog.Description>
          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={onCancel}
              disabled={loading}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
            >
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className={`rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
                danger
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {loading ? 'Aguarde...' : confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
