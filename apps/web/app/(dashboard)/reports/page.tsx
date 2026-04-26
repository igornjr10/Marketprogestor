import { FileBarChart } from 'lucide-react'

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Relatórios</h2>
        <p className="text-sm text-muted-foreground">
          Relatórios personalizados e exportações de dados.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-12 text-center">
        <FileBarChart className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
        <p className="font-semibold text-lg">Em desenvolvimento</p>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
          Relatórios customizados, exportação para CSV/PDF e agendamento de envio por e-mail
          estarão disponíveis em breve.
        </p>
      </div>
    </div>
  )
}
