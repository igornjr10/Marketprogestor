'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { BarChart2, ArrowRight } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { getClients } from '@/lib/clients'

export default function CampaignsPage() {
  const accessToken = useAuthStore((s) => s.accessToken)

  const { data, isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: () => getClients(accessToken ?? ''),
    enabled: !!accessToken,
  })

  const activeClients = data?.filter((c) => c.metaConnection?.status === 'ACTIVE') ?? []

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Campanhas</h2>
        <p className="text-sm text-muted-foreground">
          Selecione um cliente para visualizar e gerenciar suas campanhas.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : activeClients.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center">
          <BarChart2 className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
          <p className="font-medium">Nenhum cliente com Meta Ads conectado</p>
          <p className="text-sm text-muted-foreground mt-1">
            Conecte uma conta Meta Ads em{' '}
            <Link href="/clients" className="text-primary hover:underline">Clients</Link>.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card divide-y">
          {activeClients.map((client) => (
            <Link
              key={client.id}
              href={`/clients/${client.id}/campaigns`}
              className="flex items-center justify-between px-5 py-4 hover:bg-muted/50 transition-colors"
            >
              <div>
                <p className="font-medium">{client.name}</p>
                <p className="text-sm text-muted-foreground">
                  {client.metaConnection?.adAccountCount ?? 0} conta(s) de anúncio
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
