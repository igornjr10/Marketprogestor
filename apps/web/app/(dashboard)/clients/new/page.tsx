'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'
import { useAuthStore } from '@/store/auth.store'
import { createClient } from '@/lib/clients'

const schema = z.object({
  name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres').max(100),
})

type FormData = z.infer<typeof schema>

export default function NewClientPage() {
  const router = useRouter()
  const accessToken = useAuthStore((s) => s.accessToken)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormData) {
    setError(null)
    try {
      await createClient({ name: data.name }, accessToken ?? '')
      router.push('/clients')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar client')
    }
  }

  return (
    <div className="max-w-md space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Novo client</h2>
        <p className="text-muted-foreground">Adicione um cliente para gerenciar suas campanhas.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="name">
            Nome do cliente
          </label>
          <input
            id="name"
            type="text"
            placeholder="Ex: Empresa ABC"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            {...register('name')}
          />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>

        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {isSubmitting ? 'Criando...' : 'Criar client'}
          </button>
          <Link
            href="/clients"
            className="rounded-md border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  )
}
