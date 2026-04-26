'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'
import { register as registerUser } from '@/lib/auth'
import { useAuthStore } from '@/store/auth.store'

const schema = z.object({
  name: z.string().min(2, 'Nome muito curto'),
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  tenantName: z.string().min(2, 'Nome da empresa obrigatório'),
  tenantSlug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/, 'Apenas letras minúsculas, números e hífens'),
})

type FormData = z.infer<typeof schema>

export default function RegisterPage() {
  const router = useRouter()
  const setTokens = useAuthStore((s) => s.setTokens)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormData) {
    setError(null)
    try {
      const tokens = await registerUser({
        name: data.name,
        email: data.email,
        password: data.password,
        tenantName: data.tenantName,
        tenantSlug: data.tenantSlug,
      })
      setTokens(tokens)
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar conta')
    }
  }

  const fields = [
    { id: 'name', label: 'Seu nome', type: 'text', autoComplete: 'name' },
    { id: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
    { id: 'password', label: 'Senha', type: 'password', autoComplete: 'new-password' },
    { id: 'tenantName', label: 'Nome da empresa', type: 'text', autoComplete: 'organization' },
    { id: 'tenantSlug', label: 'Identificador (ex: minha-empresa)', type: 'text', autoComplete: 'off' },
  ] as const

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">MarketProAds</h1>
          <p className="mt-1 text-sm text-muted-foreground">Crie sua conta</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {fields.map(({ id, label, type, autoComplete }) => (
            <div key={id} className="space-y-1">
              <label className="text-sm font-medium" htmlFor={id}>{label}</label>
              <input
                id={id}
                type={type}
                autoComplete={autoComplete}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                {...register(id)}
              />
              {errors[id] && <p className="text-xs text-destructive">{errors[id]?.message}</p>}
            </div>
          ))}

          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {isSubmitting ? 'Criando conta...' : 'Criar conta'}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Já tem conta?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  )
}
