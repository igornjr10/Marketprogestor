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
}
