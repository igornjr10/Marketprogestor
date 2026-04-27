import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import Redis from 'ioredis'
import { PrismaService } from '../meta-sync/prisma.service'
import { evaluateRule, sinceDate, maxPeriodDays, periodDays, InsightMetricRow } from './alert-rule-engine'
import type { AlertRule } from '@marketproads/types'

type DbAlert = {
  id: string
  tenantId: string
  clientId: string | null
  name: string
  ruleJson: unknown
  channels: unknown
  cooldownMinutes: number
  notifyEmail: string | null
}

type AlertChannel = { email?: boolean; dashboard: boolean }

function parseDbAlertRule(json: unknown): AlertRule | null {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null
  const r = json as Record<string, unknown>
  if (!Array.isArray(r['conditions']) || r['conditions'].length === 0) return null
  if (r['operator'] !== 'AND' && r['operator'] !== 'OR') return null
  return json as AlertRule
}

function parseDbAlertChannels(json: unknown): AlertChannel {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return { dashboard: true }
  const c = json as Record<string, unknown>
  return {
    dashboard: c['dashboard'] !== false,
    email: c['email'] === true,
  }
}

@Injectable()
export class AlertEvaluationService {
  private readonly logger = new Logger(AlertEvaluationService.name)
  private readonly redis: Redis

  constructor(private readonly prisma: PrismaService) {
    this.redis = new Redis({
      host: process.env['REDIS_HOST'] ?? 'localhost',
      port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
    })
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async evaluateAlerts() {
    this.logger.log('Starting alert evaluation cycle')

    const alerts = await this.prisma.client.alert.findMany({
      where: { isActive: true },
      select: { id: true, tenantId: true, clientId: true, name: true, ruleJson: true, channels: true, cooldownMinutes: true, notifyEmail: true },
    }) as DbAlert[]

    if (alerts.length === 0) return

    await Promise.allSettled(alerts.map((alert) => this.evaluateAlert(alert)))
    this.logger.log(`Finished evaluating ${alerts.length} alerts`)
  }

  private async evaluateAlert(alert: DbAlert) {
    const rule = parseDbAlertRule(alert.ruleJson)
    if (!rule) {
      this.logger.warn(`Alert ${alert.id} has invalid ruleJson, skipping`)
      return
    }

    try {
      const clientIds = await this.resolveClientIds(alert)
      if (clientIds.length === 0) return

      const campaigns = await this.prisma.client.campaign.findMany({
        where: { adAccount: { clientId: { in: clientIds } } },
        select: { metaCampaignId: true, name: true },
      })

      if (campaigns.length === 0) return

      const maxDays = maxPeriodDays(rule)
      const allSince = sinceDate(maxDays * 2)

      const allInsights = await this.prisma.client.insight.findMany({
        where: {
          entityType: 'CAMPAIGN',
          entityId: { in: campaigns.map((c) => c.metaCampaignId) },
          date: { gte: allSince },
        },
        select: { entityId: true, date: true, spend: true, impressions: true, clicks: true, frequency: true, conversions: true },
      }) as InsightMetricRow[]

      for (const campaign of campaigns) {
        await this.evaluateCampaign(alert, rule, campaign, allInsights)
      }
    } catch (err) {
      this.logger.error(`Error evaluating alert ${alert.id}: ${String(err)}`)
    }
  }

  private async evaluateCampaign(
    alert: DbAlert,
    rule: AlertRule,
    campaign: { metaCampaignId: string; name: string },
    allInsights: InsightMetricRow[],
  ) {
    const primaryPeriod = rule.conditions[0]?.period ?? '7d'
    const primaryDays = periodDays(primaryPeriod)

    const currentSince = sinceDate(primaryDays)
    const previousSince = sinceDate(primaryDays * 2)

    const entityInsights = allInsights.filter((r) => r.entityId === campaign.metaCampaignId)
    const currentRows = entityInsights.filter((r) => r.date >= currentSince)
    const previousRows = entityInsights.filter((r) => r.date >= previousSince && r.date < currentSince)

    if (currentRows.length === 0) return

    const result = evaluateRule(rule, currentRows, previousRows)
    if (!result.triggers) return

    // B2: Atomic cooldown — SET NX before creating event to prevent race conditions
    const cooldownKey = `alert:cooldown:${alert.id}:${campaign.metaCampaignId}`
    const acquired = await this.redis.set(cooldownKey, '1', 'EX', alert.cooldownMinutes * 60, 'NX')
    if (!acquired) return

    await this.prisma.client.alertEvent.create({
      data: {
        alertId: alert.id,
        entityType: 'CAMPAIGN',
        entityId: campaign.metaCampaignId,
        entityName: campaign.name,
        metricValue: result.metricValue,
        ruleSnapshot: rule as object,
        status: 'OPEN',
      },
    })

    const channels = parseDbAlertChannels(alert.channels)
    if (channels.email && alert.notifyEmail) {
      await this.sendEmailNotification(alert, campaign.name, result.metricValue)
    }

    await this.redis.del(`alerts:badge:${alert.tenantId}`)
    this.logger.log(`Alert ${alert.id} triggered for campaign ${campaign.name} (value: ${result.metricValue})`)
  }

  private async resolveClientIds(alert: DbAlert): Promise<string[]> {
    if (alert.clientId) return [alert.clientId]

    const clients = await this.prisma.client.client.findMany({
      where: { tenantId: alert.tenantId, status: { not: 'DELETED' } },
      select: { id: true },
    })
    return clients.map((c) => c.id)
  }

  private async sendEmailNotification(
    alert: DbAlert,
    entityName: string,
    metricValue: number,
  ) {
    const apiKey = process.env['RESEND_API_KEY']
    const from = process.env['RESEND_FROM'] ?? 'alertas@marketproads.com.br'
    if (!apiKey || !alert.notifyEmail) return

    try {
      const body = JSON.stringify({
        from,
        to: [alert.notifyEmail],
        subject: `[MarketProAds] Alerta: ${alert.name}`,
        html: `
          <h2>Alerta disparado: ${alert.name}</h2>
          <p>Campanha: <strong>${entityName}</strong></p>
          <p>Valor da métrica: <strong>${metricValue.toFixed(2)}</strong></p>
          <p>Verifique o painel para mais detalhes.</p>
        `,
      })

      // M1: Check HTTP response status
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body,
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        this.logger.warn(`Resend error ${res.status}: ${text}`)
      }
    } catch (err) {
      this.logger.warn(`Failed to send alert email: ${String(err)}`)
    }
  }
}
