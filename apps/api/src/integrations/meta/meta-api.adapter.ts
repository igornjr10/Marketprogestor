import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Env } from '../../config/env.schema'
import type {
  MetaTokenResponse,
  MetaBusiness,
  MetaAdAccount,
  MetaTokenInfo,
  MetaSystemUser,
  MetaPaginatedResponse,
  MetaError,
} from './meta-api.types'

const RATE_LIMIT_CODES = new Set([4, 17, 32, 613])
const MAX_RETRIES = 3
const BASE_DELAY_MS = 1000

@Injectable()
export class MetaApiAdapter {
  private readonly logger = new Logger(MetaApiAdapter.name)
  private readonly baseUrl: string
  private readonly appId: string
  private readonly appSecret: string

  constructor(private readonly config: ConfigService<Env>) {
    const version = config.get('META_API_VERSION') ?? 'v21.0'
    this.baseUrl = `https://graph.facebook.com/${version}`
    this.appId = config.get('META_APP_ID') ?? ''
    this.appSecret = config.get('META_APP_SECRET') ?? ''
  }

  buildOAuthUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: this.appId,
      redirect_uri: redirectUri,
      scope: 'ads_management,ads_read,business_management,pages_read_engagement',
      response_type: 'code',
      state,
    })
    return `https://www.facebook.com/dialog/oauth?${params.toString()}`
  }

  async exchangeCodeForToken(code: string, redirectUri: string): Promise<MetaTokenResponse> {
    return this.request<MetaTokenResponse>('/oauth/access_token', {
      client_id: this.appId,
      client_secret: this.appSecret,
      redirect_uri: redirectUri,
      code,
    })
  }

  async getLongLivedToken(shortToken: string): Promise<MetaTokenResponse> {
    return this.request<MetaTokenResponse>('/oauth/access_token', {
      grant_type: 'fb_exchange_token',
      client_id: this.appId,
      client_secret: this.appSecret,
      fb_exchange_token: shortToken,
    })
  }

  async getBusinesses(token: string): Promise<MetaBusiness[]> {
    const res = await this.request<MetaPaginatedResponse<MetaBusiness>>('/me/businesses', {
      access_token: token,
      fields: 'id,name',
      limit: '100',
    })
    return res.data
  }

  async getAdAccounts(token: string, businessId: string): Promise<MetaAdAccount[]> {
    const res = await this.request<MetaPaginatedResponse<MetaAdAccount>>(
      `/${businessId}/owned_ad_accounts`,
      {
        access_token: token,
        fields: 'id,account_id,name,currency,timezone_name,account_status',
        limit: '100',
      },
    )
    return res.data
  }

  async createSystemUser(token: string, businessId: string, name: string): Promise<MetaSystemUser> {
    return this.request<MetaSystemUser>(`/${businessId}/system_users`, {
      access_token: token,
      name,
      role: 'EMPLOYEE',
    }, 'POST')
  }

  async getSystemUserToken(token: string, systemUserId: string): Promise<MetaTokenResponse> {
    return this.request<MetaTokenResponse>(`/${systemUserId}/access_tokens`, {
      access_token: token,
      app_secret: this.appSecret,
      scope: 'ads_management,ads_read,business_management,pages_read_engagement',
    }, 'POST')
  }

  async validateToken(token: string): Promise<MetaTokenInfo['data']> {
    const res = await this.request<MetaTokenInfo>('/debug_token', {
      input_token: token,
      access_token: `${this.appId}|${this.appSecret}`,
    })
    return res.data
  }

  private async request<T>(
    path: string,
    params: Record<string, string>,
    method: 'GET' | 'POST' = 'GET',
    attempt = 0,
  ): Promise<T> {
    try {
      const url = new URL(`${this.baseUrl}${path}`)

      let body: URLSearchParams | undefined
      if (method === 'GET') {
        Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
      } else {
        body = new URLSearchParams(params)
      }

      const res = await fetch(url.toString(), {
        method,
        headers: method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {},
        body: body?.toString(),
      })

      const json = await res.json() as T | MetaError

      if (!res.ok || 'error' in (json as object)) {
        const err = (json as MetaError).error
        const isRateLimit = RATE_LIMIT_CODES.has(err?.code)

        this.logger.warn(`Meta API error [${err?.code}]: ${err?.message}`)

        if (isRateLimit && attempt < MAX_RETRIES) {
          const delay = Math.pow(2, attempt) * BASE_DELAY_MS + Math.random() * 500
          this.logger.warn(`Rate limited — retry ${attempt + 1}/${MAX_RETRIES} in ${Math.round(delay)}ms`)
          await this.sleep(delay)
          return this.request<T>(path, params, method, attempt + 1)
        }

        throw new InternalServerErrorException(`Meta API: ${err?.message ?? 'Unknown error'}`)
      }

      return json as T
    } catch (err) {
      if (err instanceof InternalServerErrorException) throw err
      this.logger.error(`Meta API request failed: ${String(err)}`)
      throw new InternalServerErrorException('Falha na comunicação com Meta API')
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  // Campaign Management Methods
  async updateEntityStatus(entityType: 'CAMPAIGN' | 'ADSET' | 'AD', entityId: string, status: string, accessToken: string) {
    const endpoint = `/${entityId}`
    const response = await this.request<any>(endpoint, { status, access_token: accessToken }, 'POST')
    return response
  }

  async updateEntityBudget(
    entityType: 'CAMPAIGN' | 'ADSET',
    entityId: string,
    budgetType: 'DAILY' | 'LIFETIME',
    value: number,
    accessToken: string
  ) {
    const field = budgetType === 'DAILY' ? 'daily_budget' : 'lifetime_budget'
    const endpoint = `/${entityId}`
    const response = await this.request<any>(endpoint, { [field]: String(value), access_token: accessToken }, 'POST')
    return response
  }

  async duplicateCampaign(campaignId: string, options: { name: string; dailyBudget?: number; lifetimeBudget?: number }, accessToken: string) {
    const endpoint = `/${campaignId}/copies`
    const data: Record<string, string> = { name: options.name, access_token: accessToken }
    if (options.dailyBudget) data.daily_budget = String(options.dailyBudget)
    if (options.lifetimeBudget) data.lifetime_budget = String(options.lifetimeBudget)

    const response = await this.request<any>(endpoint, data, 'POST')
    return response.campaign_id ? { id: response.campaign_id } : response
  }

  async duplicateAdSet(adSetId: string, options: { campaignId: string }, accessToken: string) {
    const endpoint = `/${adSetId}/copies`
    const response = await this.request<any>(endpoint, { campaign_id: options.campaignId, access_token: accessToken }, 'POST')
    return response.adset_id ? { id: response.adset_id } : response
  }

  async duplicateAd(adId: string, options: { adSetId: string }, accessToken: string) {
    const endpoint = `/${adId}/copies`
    const response = await this.request<any>(endpoint, { adset_id: options.adSetId, access_token: accessToken }, 'POST')
    return response.ad_id ? { id: response.ad_id } : response
  }

  async fetchInsightsWithBreakdown(
    adAccountId: string,
    params: { since: string; until: string; breakdown: string; level?: string },
    accessToken: string,
  ): Promise<import('./meta-api.types').MetaBreakdownRow[]> {
    const endpoint = `/${adAccountId}/insights`
    const response = await this.request<import('./meta-api.types').MetaPaginatedResponse<import('./meta-api.types').MetaBreakdownRow>>(
      endpoint,
      {
        fields: 'spend,impressions,reach,clicks,frequency',
        breakdowns: params.breakdown,
        level: params.level ?? 'campaign',
        time_range: JSON.stringify({ since: params.since, until: params.until }),
        limit: '500',
        access_token: accessToken,
      },
      'GET',
    )
    return response.data ?? []
  }
}
