import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CacheService } from '../cache/cache.service'
import type {
  AlertDto, AlertEventDto, CreateAlertDto, UpdateAlertDto,
  AlertTestResult, AlertRule, AlertCondition,
} from '@marketproads/types'

type InsightRow = {
  spend: number
  impressions: number
  clicks: number
  frequency: number | null
  conversions: unknown
}

const PERIOD_DAYS: Record<string, number> = { '1d': 1, '3d': 3, '7d': 7, '14d': 14, '30d': 30 }

@Injectable()
export class AlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async getAlerts(tenantId: string, clientId?: string): Promise<AlertDto[]> {
    const alerts = await this.prisma.client.alert.findMany({
      where: { tenantId, ...(clientId ? { clientId } : {}) },
      include: { _count: { select: { alertEvents: { where: { status: 'OPEN' } } } } },
      orderBy: { createdAt: 'desc' },
    })

    return alerts.map((a) => ({
      id: a.id,
      tenantId: a.tenantId,
      clientId: a.clientId,
      name: a.name,
      description: a.description,
      rule: a.ruleJson as AlertRule,
      channels: a.channels as { email?: boolean; dashboard: boolean },
      cooldownMinutes: a.cooldownMinutes,
      isActive: a.isActive,
      createdBy: a.createdBy,
      createdAt: a.createdAt.toISOString(),
      openEventCount: a._count.alertEvents,
    }))
  }

  async createAlert(tenantId: string, userId: string, dto: CreateAlertDto): Promise<AlertDto> {
    if (dto.clientId) await this.assertClientAccess(tenantId, dto.clientId)

    const alert = await this.prisma.client.alert.create({
      data: {
        tenantId,
        clientId: dto.clientId ?? null,
        name: dto.name,
        description: dto.description ?? null,
        ruleJson: dto.rule as object,
        channels: (dto.channels ?? { dashboard: true }) as object,
        cooldownMinutes: dto.cooldownMinutes ?? 60,
        createdBy: userId,
      },
      include: { _count: { select: { alertEvents: { where: { status: 'OPEN' } } } } },
    })

    return {
      id: alert.id,
      tenantId: alert.tenantId,
      clientId: alert.clientId,
      name: alert.name,
      description: alert.description,
      rule: alert.ruleJson as AlertRule,
      channels: alert.channels as { email?: boolean; dashboard: boolean },
      cooldownMinutes: alert.cooldownMinutes,
      isActive: alert.isActive,
      createdBy: alert.createdBy,
      createdAt: alert.createdAt.toISOString(),
      openEventCount: 0,
    }
  }

  async updateAlert(tenantId: string, alertId: string, dto: UpdateAlertDto): Promise<AlertDto> {
    await this.assertAlertAccess(tenantId, alertId)

    const updated = await this.prisma.client.alert.update({
      where: { id: alertId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.rule !== undefined ? { ruleJson: dto.rule as object } : {}),
        ...(dto.channels !== undefined ? { channels: dto.channels as object } : {}),
        ...(dto.cooldownMinutes !== undefined ? { cooldownMinutes: dto.cooldownMinutes } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.clientId !== undefined ? { clientId: dto.clientId } : {}),
      },
      include: { _count: { select: { alertEvents: { where: { status: 'OPEN' } } } } },
    })

    return {
      id: updated.id,
      tenantId: updated.tenantId,
      clientId: updated.clientId,
      name: updated.name,
      description: updated.description,
      rule: updated.ruleJson as AlertRule,
      channels: updated.channels as { email?: boolean; dashboard: boolean },
      cooldownMinutes: updated.cooldownMinutes,
      isActive: updated.isActive,
      createdBy: updated.createdBy,
      createdAt: updated.createdAt.toISOString(),
      openEventCount: updated._count.alertEvents,
    }
  }

  async deleteAlert(tenantId: string, alertId: string): Promise<void> {
    await this.assertAlertAccess(tenantId, alertId)
    await this.prisma.client.alert.delete({ where: { id: alertId } })
  }

  async getAlertEvents(tenantId: string, alertId?: string, status?: string): Promise<AlertEventDto[]> {
    const events = await this.prisma.client.alertEvent.findMany({
      where: {
        alert: { tenantId },
        ...(alertId ? { alertId } : {}),
        ...(status ? { status: status as 'OPEN' | 'RESOLVED' } : {}),
      },
      include: { alert: { select: { name: true, clientId: true } } },
      orderBy: { triggeredAt: 'desc' },
      take: 200,
    })

    return events.map((e) => ({
      id: e.id,
      alertId: e.alertId,
      alertName: e.alert.name,
      clientId: e.alert.clientId,
      triggeredAt: e.triggeredAt.toISOString(),
      entityType: e.entityType,
      entityId: e.entityId,
      entityName: e.entityName,
      metricValue: e.metricValue,
      ruleSnapshot: e.ruleSnapshot as AlertRule,
      status: e.status,
      resolvedAt: e.resolvedAt?.toISOString() ?? null,
    }))
  }

  async resolveAlertEvent(tenantId: string, eventId: string): Promise<void> {
    const event = await this.prisma.client.alertEvent.findFirst({
      where: { id: eventId, alert: { tenantId } },
    })
    if (!event) throw new NotFoundException('Evento não encontrado')

    await this.prisma.client.alertEvent.update({
      where: { id: eventId },
      data: { status: 'RESOLVED', resolvedAt: new Date() },
    })

    await this.cache.del(`alerts:badge:${tenantId}`)
  }

  async getOpenEventsCount(tenantId: string): Promise<number> {
    const key = `alerts:badge:${tenantId}`
    const cached = await this.cache.get<number>(key)
    if (cached !== null) return cached

    const count = await this.prisma.client.alertEvent.count({
      where: { status: 'OPEN', alert: { tenantId } },
    })
    await this.cache.set(key, count, 60)
    return count
  }

  async testAlert(tenantId: string, alertId: string): Promise<AlertTestResult> {
    const alert = await this.assertAlertAccess(tenantId, alertId)
    const rule = alert.ruleJson as AlertRule

    const clientIds = alert.clientId
      ? [alert.clientId]
      : await this.getClientIds(tenantId)

    const campaigns = await this.prisma.client.campaign.findMany({
      where: { adAccount: { clientId: { in: clientIds } } },
      select: { metaCampaignId: true, name: true },
      take: 20,
    })

    let entitiesMatching = 0
    const longestPeriod = Math.max(
      ...rule.conditions.map((c) => PERIOD_DAYS[c.period] ?? 7),
    )
    const since = new Date()
    since.setDate(since.getDate() - longestPeriod * 2)

    const insights = await this.prisma.client.insight.findMany({
      where: {
        entityType: 'CAMPAIGN',
        entityId: { in: campaigns.map((c) => c.metaCampaignId) },
        date: { gte: since },
      },
      select: { entityId: true, date: true, spend: true, impressions: true, clicks: true, frequency: true, conversions: true },
    })

    const byEntity = new Map<string, typeof insights>()
    for (const row of insights) {
      const arr = byEntity.get(row.entityId) ?? []
      arr.push(row)
      byEntity.set(row.entityId, arr)
    }

    const conditionResults = rule.conditions.map((c) => ({
      condition: c,
      currentValue: 0,
      passed: false,
    }))

    let checked = 0
    for (const campaign of campaigns) {
      const rows = byEntity.get(campaign.metaCampaignId) ?? []
      if (rows.length === 0) continue
      checked++

      const conditionsPassed = rule.conditions.map((cond, idx) => {
        const days = PERIOD_DAYS[cond.period] ?? 7
        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() - days)
        const periodRows = rows.filter((r) => r.date >= cutoff)
        const value = this.computeMetric(cond.metric, periodRows as InsightRow[])
        const passed = this.evaluateComparator(cond.comparator, value, cond.value)
        conditionResults[idx].currentValue = value
        conditionResults[idx].passed = passed
        return passed
      })

      const triggers = rule.operator === 'AND'
        ? conditionsPassed.every(Boolean)
        : conditionsPassed.some(Boolean)

      if (triggers) entitiesMatching++
    }

    return {
      wouldTrigger: entitiesMatching > 0,
      evaluatedConditions: conditionResults,
      entitiesChecked: checked,
      entitiesMatching,
    }
  }

  computeMetric(metric: string, rows: InsightRow[]): number {
    if (rows.length === 0) return 0
    const spend = rows.reduce((s, r) => s + r.spend, 0)
    const impressions = rows.reduce((s, r) => s + r.impressions, 0)
    const clicks = rows.reduce((s, r) => s + r.clicks, 0)
    const frequency = rows.reduce((s, r) => s + (r.frequency ?? 0), 0) / rows.length

    const actions = rows.flatMap((r) => (Array.isArray(r.conversions) ? r.conversions as Array<Record<string, string>> : []))
    const conversions = actions.filter((a) => a['action_type'] === 'purchase' || a['action_type'] === 'lead')
      .reduce((s, a) => s + parseFloat(a['value'] ?? '0'), 0)

    switch (metric) {
      case 'spend': return spend
      case 'ctr': return impressions > 0 ? (clicks / impressions) * 100 : 0
      case 'cpm': return impressions > 0 ? (spend / impressions) * 1000 : 0
      case 'frequency': return frequency
      case 'cpa': return conversions > 0 ? spend / conversions : 0
      case 'roas': return spend > 0 ? conversions / spend : 0
      default: return 0
    }
  }

  evaluateComparator(comparator: string, value: number, threshold: number): boolean {
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

  private async assertAlertAccess(tenantId: string, alertId: string) {
    const alert = await this.prisma.client.alert.findFirst({ where: { id: alertId, tenantId } })
    if (!alert) throw new NotFoundException('Alerta não encontrado')
    return alert
  }

  private async assertClientAccess(tenantId: string, clientId: string) {
    const client = await this.prisma.client.client.findFirst({ where: { id: clientId, tenantId } })
    if (!client) throw new ForbiddenException('Client não encontrado')
  }

  private async getClientIds(tenantId: string): Promise<string[]> {
    const clients = await this.prisma.client.client.findMany({
      where: { tenantId, status: { not: 'DELETED' } },
      select: { id: true },
    })
    return clients.map((c) => c.id)
  }
}
