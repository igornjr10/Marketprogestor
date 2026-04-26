'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useAuthStore } from '@/store/auth.store'
import { getClients } from '@/lib/clients'
import { Users, Plus, Wifi, WifiOff } from 'lucide-react'
import type { Client } from '@marketproads/types'

export default function ClientsPage() {
  const accessToken = useAuthStore((s) => s.accessToken)
  const { data: clients, isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: () => getClients(accessToken ?? ''),
    enabled: !!accessToken,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Clients</h2>
          <p className="text-muted-foreground">Gerencie seus clientes e conexões Meta Ads.</p>
        </div>
        <Link
          href="/clients/new"
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Novo client
        </Link>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}

      {!isLoading && clients?.length === 0 && (
        <div className="rounded-lg border bg-card p-12 text-center">
          <Users className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-medium">Nenhum client cadastrado</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Crie seu primeiro client para conectar uma conta Meta Ads.
          </p>
          <Link
            href="/clients/new"
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Criar client
          </Link>
        </div>
      )}

      {clients && clients.length > 0 && (
        <div className="grid gap-3">
          {clients.map((client) => (
            <ClientCard key={client.id} client={client} />
          ))}
        </div>
      )}
    </div>
  )
}

function ClientCard({ client }: { client: Client }) {
  const isConnected = client.metaConnection?.status === 'ACTIVE'

  return (
    <Link
      href={`/clients/${client.id}`}
      className="flex items-center justify-between rounded-lg border bg-card p-4 transition hover:border-primary/50"
    >
      <div className="space-y-0.5">
        <p className="font-medium">{client.name}</p>
        {client.metaConnection ? (
          <p className="text-xs text-muted-foreground">
            {client.metaConnection.businessName} · {client.metaConnection.adAccountCount} conta(s)
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Sem conexão Meta</p>
        )}
      </div>
      {isConnected ? (
        <span className="flex items-center gap-1 rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-600">
          <Wifi className="h-3 w-3" />
          Conectado
        </span>
      ) : (
        <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
          <WifiOff className="h-3 w-3" />
          Desconectado
        </span>
      )}
    </Link>
  )
}
