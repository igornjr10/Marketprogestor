import type { AlertRule, AlertCondition } from '@marketproads/types'

const PERIOD_DAYS: Record<string, number> = { '1d': 1, '3d': 3, '7d': 7, '14d': 14, '30d': 30 }

export type InsightMetricRow = {
  entityId: string
  date: Date
  spend: number
  impressions: number
  clicks: number
  frequency: number | null
  conversions: unknown
}

export type ComputedMetrics = {
  spend: number
  ctr: number
  cpm: number
  frequency: number
  cpa: number
  roas: number
}

export type ConditionResult = {
  condition: AlertCondition
  currentValue: number
  previousValue: number
  passed: boolean
}

export type EvaluationResult = {
  triggers: boolean
  conditions: ConditionResult[]
  metricValue: number
}

export function computeMetrics(rows: InsightMetricRow[]): ComputedMetrics {
  if (rows.length === 0) return { spend: 0, ctr: 0, cpm: 0, frequency: 0, cpa: 0, roas: 0 }

  const spend = rows.reduce((s, r) => s + r.spend, 0)
  const impressions = rows.reduce((s, r) => s + r.impressions, 0)
  const clicks = rows.reduce((s, r) => s + r.clicks, 0)
  const freqSum = rows.reduce((s, r) => s + (r.frequency ?? 0), 0)

  const actions = rows.flatMap((r) =>
    Array.isArray(r.conversions) ? (r.conversions as Array<Record<string, string>>) : [],
  )
  const conversionCount = actions
    .filter((a) => a['action_type'] === 'purchase' || a['action_type'] === 'lead')
    .reduce((s, a) => s + parseFloat(a['value'] ?? '0'), 0)

  return {
    spend,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
    frequency: rows.length > 0 ? freqSum / rows.length : 0,
    cpa: conversionCount > 0 ? spend / conversionCount : 0,
    roas: spend > 0 ? conversionCount / spend : 0,
  }
}

function getMetricValue(metrics: ComputedMetrics, metric: string): number {
  return (metrics as Record<string, number>)[metric] ?? 0
}

function evaluateComparator(comparator: string, value: number, threshold: number): boolean {
  switch (comparator) {
    case 'gt': return value > threshold
    case 'gte': return value >= threshold
    case 'lt': return value < threshold
    case 'lte': return value <= threshold
    case 'eq': return Math.abs(value - threshold) < 0.001
    case 'change_pct': return value <= threshold
    default: return false
  }
}

export function evaluateRule(
  rule: AlertRule,
  currentRows: InsightMetricRow[],
  previousRows: InsightMetricRow[],
): EvaluationResult {
  const currentMetrics = computeMetrics(currentRows)
  const previousMetrics = computeMetrics(previousRows)

  const conditions: ConditionResult[] = rule.conditions.map((cond) => {
    let currentValue = getMetricValue(currentMetrics, cond.metric)
    const previousValue = getMetricValue(previousMetrics, cond.metric)

    if (cond.comparator === 'change_pct') {
      currentValue = previousValue > 0 ? ((currentValue - previousValue) / previousValue) * 100 : 0
    }

    const passed = evaluateComparator(cond.comparator, currentValue, cond.value)
    return { condition: cond, currentValue, previousValue, passed }
  })

  const triggers = rule.operator === 'AND'
    ? conditions.every((c) => c.passed)
    : conditions.some((c) => c.passed)

  const primaryMetric = conditions[0]?.currentValue ?? 0

  return { triggers, conditions, metricValue: primaryMetric }
}

export function sinceDate(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(0, 0, 0, 0)
  return d
}

export function maxPeriodDays(rule: AlertRule): number {
  return Math.max(...rule.conditions.map((c) => PERIOD_DAYS[c.period] ?? 7))
}

export function periodDays(period: string): number {
  return PERIOD_DAYS[period] ?? 7
}
