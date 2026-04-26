export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">Bem-vindo à plataforma MarketProAds.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {['Campanhas Ativas', 'Investimento Total', 'Leads Gerados', 'ROAS Médio'].map((title) => (
          <div key={title} className="rounded-lg border bg-card p-6 shadow-sm">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="mt-2 text-3xl font-bold">—</p>
            <p className="mt-1 text-xs text-muted-foreground">Conecte uma conta de anúncios</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h3 className="font-semibold">Primeiros passos</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Para começar, conecte sua conta Meta Ads em <strong>Configurações → Integrações</strong>.
        </p>
      </div>
    </div>
  )
}
