import { z } from 'zod'
import type { AlertRule, AlertChannels } from '@marketproads/types'

const AlertConditionSchema = z.object({
  metric: z.enum(['spend', 'ctr', 'cpm', 'frequency', 'roas', 'cpa']),
  comparator: z.enum(['gt', 'gte', 'lt', 'lte', 'eq', 'change_pct']),
  value: z.number(),
  period: z.enum(['1d', '3d', '7d', '14d', '30d']),
})

export const AlertRuleSchema = z.object({
  conditions: z.array(AlertConditionSchema).min(1),
  operator: z.enum(['AND', 'OR']),
})

export const AlertChannelsSchema = z.object({
  email: z.boolean().optional(),
  dashboard: z.boolean(),
})

export function parseAlertRule(json: unknown): AlertRule {
  return AlertRuleSchema.parse(json) as AlertRule
}

export function parseAlertChannels(json: unknown): AlertChannels {
  return AlertChannelsSchema.parse(json) as AlertChannels
}
