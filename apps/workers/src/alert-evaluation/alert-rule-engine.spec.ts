import { evaluateRule, computeMetrics, InsightMetricRow } from './alert-rule-engine'
import type { AlertRule } from '@marketproads/types'

const makeRow = (overrides: Partial<InsightMetricRow> = {}): InsightMetricRow => ({
  entityId: 'c-1',
  date: new Date(),
  spend: 100,
  impressions: 10000,
  clicks: 150,
  frequency: 2.0,
  conversions: [{ action_type: 'purchase', value: '1' }],
  ...overrides,
})

const rows7 = Array.from({ length: 7 }, (_, i) =>
  makeRow({ date: new Date(2026, 0, i + 1) }),
)

describe('computeMetrics', () => {
  it('computes spend correctly', () => {
    const m = computeMetrics(rows7)
    expect(m.spend).toBe(700)
  })

  it('computes CTR correctly', () => {
    const m = computeMetrics(rows7)
    expect(m.ctr).toBeCloseTo(1.5, 2)
  })

  it('computes CPM correctly', () => {
    const m = computeMetrics(rows7)
    expect(m.cpm).toBeCloseTo(10, 2)
  })

  it('computes frequency correctly', () => {
    const m = computeMetrics(rows7)
    expect(m.frequency).toBe(2.0)
  })

  it('returns zeros for empty rows', () => {
    const m = computeMetrics([])
    expect(m.spend).toBe(0)
    expect(m.ctr).toBe(0)
  })
})

describe('evaluateRule', () => {
  it('triggers when single gt condition passes', () => {
    const rule: AlertRule = {
      conditions: [{ metric: 'spend', comparator: 'gt', value: 500, period: '7d' }],
      operator: 'AND',
    }
    const result = evaluateRule(rule, rows7, [])
    expect(result.triggers).toBe(true)
  })

  it('does not trigger when gt condition fails', () => {
    const rule: AlertRule = {
      conditions: [{ metric: 'spend', comparator: 'gt', value: 1000, period: '7d' }],
      operator: 'AND',
    }
    const result = evaluateRule(rule, rows7, [])
    expect(result.triggers).toBe(false)
  })

  it('triggers with AND: both conditions must pass', () => {
    const rule: AlertRule = {
      conditions: [
        { metric: 'spend', comparator: 'gt', value: 500, period: '7d' },
        { metric: 'frequency', comparator: 'gt', value: 1.5, period: '7d' },
      ],
      operator: 'AND',
    }
    expect(evaluateRule(rule, rows7, []).triggers).toBe(true)
  })

  it('does not trigger with AND when one condition fails', () => {
    const rule: AlertRule = {
      conditions: [
        { metric: 'spend', comparator: 'gt', value: 500, period: '7d' },
        { metric: 'frequency', comparator: 'gt', value: 5, period: '7d' }, // fails
      ],
      operator: 'AND',
    }
    expect(evaluateRule(rule, rows7, []).triggers).toBe(false)
  })

  it('triggers with OR: one condition is enough', () => {
    const rule: AlertRule = {
      conditions: [
        { metric: 'spend', comparator: 'gt', value: 9999, period: '7d' }, // fails
        { metric: 'frequency', comparator: 'gt', value: 1.5, period: '7d' }, // passes
      ],
      operator: 'OR',
    }
    expect(evaluateRule(rule, rows7, []).triggers).toBe(true)
  })

  it('evaluates gte comparator correctly', () => {
    const rule: AlertRule = {
      conditions: [{ metric: 'spend', comparator: 'gte', value: 700, period: '7d' }],
      operator: 'AND',
    }
    expect(evaluateRule(rule, rows7, []).triggers).toBe(true)
  })

  it('evaluates lt comparator correctly', () => {
    const rule: AlertRule = {
      conditions: [{ metric: 'ctr', comparator: 'lt', value: 2, period: '7d' }],
      operator: 'AND',
    }
    expect(evaluateRule(rule, rows7, []).triggers).toBe(true)
  })

  it('evaluates change_pct: triggers when current drops below threshold', () => {
    const previousRows = Array.from({ length: 7 }, (_, i) =>
      makeRow({ date: new Date(2025, 11, i + 1), clicks: 200 }),
    )
    const currentRows = Array.from({ length: 7 }, (_, i) =>
      makeRow({ date: new Date(2026, 0, i + 1), clicks: 100 }),
    )
    const rule: AlertRule = {
      conditions: [{ metric: 'ctr', comparator: 'change_pct', value: -20, period: '7d' }],
      operator: 'AND',
    }
    const result = evaluateRule(rule, currentRows, previousRows)
    expect(result.triggers).toBe(true)
    expect(result.conditions[0].currentValue).toBeLessThan(-20)
  })

  it('returns metricValue from first condition', () => {
    const rule: AlertRule = {
      conditions: [{ metric: 'spend', comparator: 'gt', value: 500, period: '7d' }],
      operator: 'AND',
    }
    const result = evaluateRule(rule, rows7, [])
    expect(result.metricValue).toBe(700)
  })
})
