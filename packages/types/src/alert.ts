export type AlertMetric = 'spend' | 'ctr' | 'cpm' | 'frequency' | 'roas' | 'cpa'
export type AlertComparator = 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'change_pct'
export type AlertPeriod = '1d' | '3d' | '7d' | '14d' | '30d'

export type AlertCondition = {
  metric: AlertMetric
  comparator: AlertComparator
  value: number
  period: AlertPeriod
}

export type AlertRule = {
  conditions: AlertCondition[]
  operator: 'AND' | 'OR'
}

export type AlertChannels = {
  email?: boolean
  dashboard: boolean
}

export type AlertDto = {
  id: string
  tenantId: string
  clientId?: string | null
  name: string
  description?: string | null
  rule: AlertRule
  channels: AlertChannels
  cooldownMinutes: number
  isActive: boolean
  createdBy: string
  createdAt: string
  openEventCount: number
}

export type AlertEventDto = {
  id: string
  alertId: string
  alertName: string
  clientId?: string | null
  triggeredAt: string
  entityType: string
  entityId: string
  entityName: string
  metricValue: number
  ruleSnapshot: AlertRule
  status: 'OPEN' | 'RESOLVED'
  resolvedAt?: string | null
}

export type CreateAlertDto = {
  name: string
  description?: string
  clientId?: string
  rule: AlertRule
  channels: AlertChannels
  cooldownMinutes?: number
}

export type UpdateAlertDto = Partial<CreateAlertDto> & { isActive?: boolean }

export type AlertTestResult = {
  wouldTrigger: boolean
  evaluatedConditions: Array<{
    condition: AlertCondition
    currentValue: number
    passed: boolean
  }>
  entitiesChecked: number
  entitiesMatching: number
}

export type AlertTemplate = {
  id: string
  name: string
  description: string
  rule: AlertRule
  defaultCooldownMinutes: number
}

export const ALERT_TEMPLATES: AlertTemplate[] = [
  {
    id: 'high-cpa-3d',
    name: 'CPA acima da meta por 3 dias',
    description: 'Dispara quando o CPA médio dos últimos 3 dias supera o limite definido.',
    rule: { conditions: [{ metric: 'cpa', comparator: 'gt', value: 50, period: '3d' }], operator: 'AND' },
    defaultCooldownMinutes: 1440,
  },
  {
    id: 'fatigue-freq-ctr',
    name: 'Frequência alta com queda de CTR',
    description: 'Detecta possível fadiga criativa: frequência elevada e CTR baixo.',
    rule: {
      conditions: [
        { metric: 'frequency', comparator: 'gt', value: 3.5, period: '3d' },
        { metric: 'ctr', comparator: 'lt', value: 1.0, period: '3d' },
      ],
      operator: 'AND',
    },
    defaultCooldownMinutes: 720,
  },
  {
    id: 'high-spend-7d',
    name: 'Gasto acelerado (7 dias)',
    description: 'Alerta quando o gasto semanal supera o limite configurado.',
    rule: { conditions: [{ metric: 'spend', comparator: 'gt', value: 5000, period: '7d' }], operator: 'AND' },
    defaultCooldownMinutes: 1440,
  },
  {
    id: 'low-roas-7d',
    name: 'ROAS abaixo de 1 por 7 dias',
    description: 'Campanha gastando mais do que retorna em conversões.',
    rule: { conditions: [{ metric: 'roas', comparator: 'lt', value: 1, period: '7d' }], operator: 'AND' },
    defaultCooldownMinutes: 1440,
  },
  {
    id: 'high-cpm',
    name: 'CPM muito alto',
    description: 'Custo por mil impressões acima do limiar configurado.',
    rule: { conditions: [{ metric: 'cpm', comparator: 'gt', value: 30, period: '3d' }], operator: 'AND' },
    defaultCooldownMinutes: 720,
  },
  {
    id: 'ctr-drop',
    name: 'CTR em queda acentuada',
    description: 'CTR caiu mais de 30% em relação ao período base.',
    rule: { conditions: [{ metric: 'ctr', comparator: 'change_pct', value: -30, period: '7d' }], operator: 'AND' },
    defaultCooldownMinutes: 1440,
  },
  {
    id: 'high-frequency',
    name: 'Frequência excessiva',
    description: 'Mesmo público sendo impactado muitas vezes — risco de saturação.',
    rule: { conditions: [{ metric: 'frequency', comparator: 'gt', value: 5, period: '7d' }], operator: 'AND' },
    defaultCooldownMinutes: 720,
  },
]
