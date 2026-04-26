import { Injectable, BadRequestException, ConflictException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { MetaApiAdapter } from '../integrations/meta/meta-api.adapter'
import { CacheService } from '../cache/cache.service'

export type EntityType = 'CAMPAIGN' | 'ADSET' | 'AD'
export type BudgetType = 'DAILY' | 'LIFETIME'

export type ToggleStatusInput = {
  entityType: EntityType
  entityId: string
  newStatus: string
  userId: string
}

export type UpdateBudgetInput = {
  entityType: EntityType
  entityId: string
  budgetType: BudgetType
  value: number
  userId: string
}

export type DuplicateCampaignInput = {
  campaignId: string
  options: {
    name: string
    dailyBudget?: number
    lifetimeBudget?: number
    includeCreatives: boolean
  }
  userId: string
}

@Injectable()
export class CampaignManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly meta: MetaApiAdapter,
    private readonly cache: CacheService,
  ) {}

  async toggleStatus(input: ToggleStatusInput) {
    const { entityType, entityId, newStatus, userId } = input

    // Get current entity and access token
    const { entity, accessToken } = await this.getEntityWithToken(entityType, entityId)
    if (!entity) throw new BadRequestException('Entidade não encontrada')

    // Validate status transition
    this.validateStatusTransition(entity.status, newStatus)

    // Get Meta API ID
    const metaId = this.getMetaId(entityType, entity)

    // Call Meta API
    await this.meta.updateEntityStatus(entityType, metaId, newStatus, accessToken)

    // Update local database
    const updatedEntity = await this.updateEntityStatus(entityType, entityId, newStatus)

    // Create audit log
    await this.createAuditLog({
      userId,
      action: 'STATUS_CHANGE',
      entityType,
      entityId,
      before: { status: entity.status },
      after: { status: newStatus },
    })

    // Invalidate cache
    await this.invalidateEntityCache(entityType, entityId)

    return updatedEntity
  }

  async updateBudget(input: UpdateBudgetInput) {
    const { entityType, entityId, budgetType, value, userId } = input

    if (value <= 0) throw new BadRequestException('Orçamento deve ser maior que zero')

    // Get current entity and access token
    const { entity, accessToken } = await this.getEntityWithToken(entityType, entityId)
    if (!entity) throw new BadRequestException('Entidade não encontrada')

    // Check for significant budget changes (>50%)
    const currentBudget = this.getCurrentBudget(entity, budgetType)
    if (currentBudget && this.isSignificantChange(currentBudget, value)) {
      throw new ConflictException('Mudança de orçamento >50% requer confirmação extra')
    }

    // Get Meta API ID
    const metaId = this.getMetaId(entityType, entity)

    // Call Meta API
    if (entityType !== 'AD') {
      await this.meta.updateEntityBudget(entityType, metaId, budgetType, value, accessToken)
    } else {
      throw new BadRequestException('Anúncios não suportam atualização de orçamento')
    }

    // Update local database
    const updatedEntity = await this.updateEntityBudget(entityType, entityId, budgetType, value)

    // Create audit log
    await this.createAuditLog({
      userId,
      action: 'BUDGET_UPDATE',
      entityType,
      entityId,
      before: { [budgetType.toLowerCase() + 'Budget']: currentBudget },
      after: { [budgetType.toLowerCase() + 'Budget']: value },
    })

    // Invalidate cache
    await this.invalidateEntityCache(entityType, entityId)

    return updatedEntity
  }

  async duplicateCampaign(input: DuplicateCampaignInput) {
    const { campaignId, options, userId } = input

    // Get original campaign and access token
    const { entity: campaign, accessToken } = await this.getEntityWithToken('CAMPAIGN', campaignId)
    if (!campaign) throw new BadRequestException('Campanha não encontrada')

    // Call Meta API to duplicate
    const duplicatedMetaCampaign = await this.meta.duplicateCampaign(campaign.metaCampaignId, options, accessToken)

    // Create new campaign in database
    const newCampaign = await this.prisma.client.campaign.create({
      data: {
        adAccountId: campaign.adAccountId,
        metaCampaignId: duplicatedMetaCampaign.id,
        name: options.name,
        objective: campaign.objective,
        status: 'PAUSED',
        dailyBudget: options.dailyBudget,
        lifetimeBudget: options.lifetimeBudget,
        startTime: new Date(),
        createdTime: new Date(),
        updatedTime: new Date(),
      },
    })

    // Duplicate ad sets and ads if requested
    if (options.includeCreatives) {
      const adSets = await this.prisma.client.adSet.findMany({
        where: { campaignId },
        include: { ads: true },
      })

      for (const adSet of adSets) {
        const duplicatedMetaAdSet = await this.meta.duplicateAdSet(adSet.metaAdSetId, {
          campaignId: duplicatedMetaCampaign.id,
        }, accessToken)

        const newAdSet = await this.prisma.client.adSet.create({
          data: {
            campaignId: newCampaign.id,
            metaAdSetId: duplicatedMetaAdSet.id,
            name: adSet.name,
            status: 'PAUSED',
            dailyBudget: adSet.dailyBudget,
            lifetimeBudget: adSet.lifetimeBudget,
            targeting: adSet.targeting as any, // JsonValue to InputJsonValue
            optimizationGoal: adSet.optimizationGoal,
            billingEvent: adSet.billingEvent,
            startTime: new Date(),
            createdTime: new Date(),
            updatedTime: new Date(),
          },
        })

        for (const ad of adSet.ads) {
          const duplicatedMetaAd = await this.meta.duplicateAd(ad.metaAdId, {
            adSetId: duplicatedMetaAdSet.id,
          }, accessToken)

          await this.prisma.client.ad.create({
            data: {
              adSetId: newAdSet.id,
              metaAdId: duplicatedMetaAd.id,
              name: ad.name,
              status: 'PAUSED',
              creativeId: ad.creativeId,
              creativeData: ad.creativeData as any, // JsonValue to InputJsonValue
              createdTime: new Date(),
              updatedTime: new Date(),
            },
          })
        }
      }
    }

    // Create audit log
    await this.createAuditLog({
      userId,
      action: 'CAMPAIGN_DUPLICATED',
      entityType: 'CAMPAIGN',
      entityId: newCampaign.id,
      before: null,
      after: { originalCampaignId: campaignId, options },
    })

    return newCampaign
  }

  async dryRun(entityType: EntityType, entityId: string, changes: Record<string, any>) {
    const entity = await this.getEntity(entityType, entityId)
    if (!entity) throw new BadRequestException('Entidade não encontrada')

    const impacts = []

    // Check budget changes
    if (changes.dailyBudget !== undefined && 'dailyBudget' in entity) {
      const current = entity.dailyBudget
      if (current && this.isSignificantChange(current, changes.dailyBudget)) {
        impacts.push({
          type: 'BUDGET_SIGNIFICANT_CHANGE',
          message: `Mudança de orçamento diário de ${current} para ${changes.dailyBudget} (${Math.round((Math.abs(changes.dailyBudget - current) / current) * 100)}% de mudança)`,
          requiresConfirmation: true,
        })
      }
    }

    if (changes.lifetimeBudget !== undefined && 'lifetimeBudget' in entity) {
      const current = entity.lifetimeBudget
      if (current && this.isSignificantChange(current, changes.lifetimeBudget)) {
        impacts.push({
          type: 'BUDGET_SIGNIFICANT_CHANGE',
          message: `Mudança de orçamento vitalício de ${current} para ${changes.lifetimeBudget} (${Math.round((Math.abs(changes.lifetimeBudget - current) / current) * 100)}% de mudança)`,
          requiresConfirmation: true,
        })
      }
    }

    // Check status changes
    if (changes.status !== undefined && changes.status !== entity.status) {
      impacts.push({
        type: 'STATUS_CHANGE',
        message: `Status mudará de ${entity.status} para ${changes.status}`,
        requiresConfirmation: changes.status === 'PAUSED',
      })
    }

    return {
      current: entity,
      proposed: { ...entity, ...changes },
      impacts,
    }
  }

  private async getEntity(entityType: EntityType, entityId: string) {
    switch (entityType) {
      case 'CAMPAIGN':
        return this.prisma.client.campaign.findUnique({ where: { id: entityId } })
      case 'ADSET':
        return this.prisma.client.adSet.findUnique({ where: { id: entityId } })
      case 'AD':
        return this.prisma.client.ad.findUnique({ where: { id: entityId } })
    }
  }

  private async getEntityWithToken(entityType: EntityType, entityId: string) {
    let entity: any
    let accessToken: string

    switch (entityType) {
      case 'CAMPAIGN':
        entity = await this.prisma.client.campaign.findUnique({
          where: { id: entityId },
          include: { adAccount: { include: { client: { include: { metaConnections: true } } } } },
        })
        break
      case 'ADSET':
        entity = await this.prisma.client.adSet.findUnique({
          where: { id: entityId },
          include: {
            campaign: {
              include: { adAccount: { include: { client: { include: { metaConnections: true } } } } },
            },
          },
        })
        break
      case 'AD':
        entity = await this.prisma.client.ad.findUnique({
          where: { id: entityId },
          include: {
            adSet: {
              include: {
                campaign: {
                  include: { adAccount: { include: { client: { include: { metaConnections: true } } } } },
                },
              },
            },
          },
        })
        break
    }

    if (!entity) return { entity: null, accessToken: '' }

    // Extract access token from meta connection
    const metaConnection = entity.adAccount?.client?.metaConnections?.[0]
    if (!metaConnection?.accessTokenEncrypted) {
      throw new BadRequestException('Token de acesso não encontrado')
    }

    const { decrypt } = await import('@marketproads/crypto')
    accessToken = decrypt(metaConnection.accessTokenEncrypted)

    return { entity, accessToken }
  }

  private getMetaId(entityType: EntityType, entity: any): string {
    switch (entityType) {
      case 'CAMPAIGN':
        return entity.metaCampaignId
      case 'ADSET':
        return entity.metaAdSetId
      case 'AD':
        return entity.metaAdId
    }
  }

  private async updateEntityStatus(entityType: EntityType, entityId: string, status: string) {
    const updateData = { status, updatedTime: new Date(), lastSyncedAt: new Date() }

    switch (entityType) {
      case 'CAMPAIGN':
        return this.prisma.client.campaign.update({ where: { id: entityId }, data: updateData })
      case 'ADSET':
        return this.prisma.client.adSet.update({ where: { id: entityId }, data: updateData })
      case 'AD':
        return this.prisma.client.ad.update({ where: { id: entityId }, data: updateData })
    }
  }

  private async updateEntityBudget(entityType: EntityType, entityId: string, budgetType: BudgetType, value: number) {
    const field = budgetType === 'DAILY' ? 'dailyBudget' : 'lifetimeBudget'
    const updateData = { [field]: value, updatedTime: new Date(), lastSyncedAt: new Date() }

    switch (entityType) {
      case 'CAMPAIGN':
        return this.prisma.client.campaign.update({ where: { id: entityId }, data: updateData })
      case 'ADSET':
        return this.prisma.client.adSet.update({ where: { id: entityId }, data: updateData })
      default:
        throw new BadRequestException('Tipo de entidade não suporta atualização de orçamento')
    }
  }

  private validateStatusTransition(currentStatus: string, newStatus: string) {
    const validTransitions = {
      ACTIVE: ['PAUSED'],
      PAUSED: ['ACTIVE'],
      DELETED: [], // Cannot change from deleted
    }

    const validStatuses = validTransitions[currentStatus as keyof typeof validTransitions] as string[] | undefined
    if (!validStatuses || !validStatuses.includes(newStatus)) {
      throw new BadRequestException(`Transição de status inválida: ${currentStatus} -> ${newStatus}`)
    }
  }

  private getCurrentBudget(entity: any, budgetType: BudgetType): number | null {
    if (entity.dailyBudget === undefined && entity.lifetimeBudget === undefined) {
      return null // AD doesn't have budget fields
    }
    return budgetType === 'DAILY' ? entity.dailyBudget : entity.lifetimeBudget
  }

  private isSignificantChange(current: number, newValue: number): boolean {
    return Math.abs(newValue - current) / current > 0.5
  }

  private async createAuditLog(log: {
    userId: string
    action: string
    entityType: string
    entityId: string
    before?: any
    after?: any
  }) {
    // Get tenant from user
    const user = await this.prisma.client.user.findUnique({
      where: { id: log.userId },
      select: { tenantId: true },
    })

    if (!user) throw new BadRequestException('Usuário não encontrado')

    await this.prisma.rawClient.auditLog.create({
      data: {
        userId: log.userId,
        tenantId: user.tenantId,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        before: log.before || null,
        after: log.after || null,
      },
    })
  }

  private async invalidateEntityCache(entityType: EntityType, entityId: string) {
    // Invalidate related caches
    const patterns = [`campaigns:*`, `insights:*`, `audit:*`]
    await Promise.all(patterns.map(pattern => this.cache.invalidatePattern(pattern)))
  }
}