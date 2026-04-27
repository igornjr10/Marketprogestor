import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common'
import { MetaPaginatedResponse, MetaCampaign, MetaAdSet, MetaAd, MetaInsightRow, MetaCreativeRow, MetaBreakdownRow } from './meta-api.types'
import { RateLimitHandler } from '../meta-sync/rate-limit.handler'

const RATE_LIMIT_CODES = new Set([4, 17, 32, 613])
const MAX_RETRIES = 3
const BASE_DELAY_MS = 1000

@Injectable()
export class MetaApiAdapter {
  private readonly logger = new Logger(MetaApiAdapter.name)
  private readonly baseUrl = `https://graph.facebook.com/${process.env['META_API_VERSION'] ?? 'v21.0'}`
  private readonly appId = process.env['META_APP_ID'] ?? ''
  private readonly appSecret = process.env['META_APP_SECRET'] ?? ''

  constructor(private readonly rateLimitHandler: RateLimitHandler) {}

  async getCampaigns(token: string, adAccountId: string): Promise<MetaCampaign[]> {
    return this.fetchAllPages<MetaCampaign>(`/${adAccountId}/campaigns`, {
      access_token: token,
      fields: 'id,name,objective,status,daily_budget,lifetime_budget,start_time,stop_time,created_time,updated_time',
      limit: '100',
    })
  }

  async getAdSets(token: string, adAccountId: string): Promise<MetaAdSet[]> {
    return this.fetchAllPages<MetaAdSet>(`/${adAccountId}/adsets`, {
      access_token: token,
      fields: 'id,name,status,campaign_id,daily_budget,lifetime_budget,targeting,optimization_goal,billing_event,start_time,end_time,created_time,updated_time',
      limit: '100',
    })
  }

  async getAds(token: string, adAccountId: string): Promise<MetaAd[]> {
    return this.fetchAllPages<MetaAd>(`/${adAccountId}/ads`, {
      access_token: token,
      fields: 'id,name,status,adset_id,campaign_id,creative_id,created_time,updated_time,creative',
      limit: '100',
    })
  }

  async getInsights(
    token: string,
    adAccountId: string,
    level: 'campaign' | 'adset' | 'ad',
    since: string,
    until: string,
  ): Promise<MetaInsightRow[]> {
    return this.fetchAllPages<MetaInsightRow>(`/${adAccountId}/insights`, {
      access_token: token,
      level,
      time_increment: '1',
      time_range: JSON.stringify({ since, until }),
      fields: 'date_start,date_stop,spend,impressions,reach,clicks,frequency,actions,video_30_sec_watched_actions',
      limit: '100',
    })
  }

  async getInsightsWithBreakdown(
    token: string,
    adAccountId: string,
    breakdown: string,
    since: string,
    until: string,
  ): Promise<MetaBreakdownRow[]> {
    return this.fetchAllPages<MetaBreakdownRow>(`/${adAccountId}/insights`, {
      access_token: token,
      level: 'campaign',
      breakdowns: breakdown,
      time_range: JSON.stringify({ since, until }),
      fields: 'spend,impressions,reach,clicks,frequency,campaign_id',
      limit: '500',
    })
  }

  async getAdCreatives(token: string, adAccountId: string): Promise<MetaCreativeRow[]> {
    return this.fetchAllPages<MetaCreativeRow>(`/${adAccountId}/ads`, {
      access_token: token,
      fields: 'id,creative_id,adset_id,name,status,creative{thumbnail_url,image_url,video_id,body,title,call_to_action_type,object_type}',
      limit: '100',
    })
  }

  private async fetchAllPages<T>(path: string, params: Record<string, string>, attempt = 0): Promise<T[]> {
    try {
      const url = new URL(`${this.baseUrl}${path}`)
      Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value))

      const res = await fetch(url.toString(), { method: 'GET' })
      const headers = {
        'x-business-use-case-usage': res.headers.get('x-business-use-case-usage') ?? '',
        'x-app-usage': res.headers.get('x-app-usage') ?? '',
      }

      if (await this.rateLimitHandler.shouldThrottle(headers)) {
        throw new InternalServerErrorException('Meta API usage exceeded, cooling down')
      }

      const json = (await res.json()) as MetaPaginatedResponse<T> | { error: unknown }
      if (!res.ok || 'error' in json) {
        const error = (json as { error: any }).error
        const isRetryable = RATE_LIMIT_CODES.has(error?.code)
        this.logger.warn(`Meta API error [${error?.code}]: ${error?.message}`)

        if (isRetryable && attempt < MAX_RETRIES) {
          const delay = Math.pow(2, attempt) * BASE_DELAY_MS + Math.random() * 500
          this.logger.warn(`Retrying Meta request (${attempt + 1}) after ${Math.round(delay)}ms`)
          await this.sleep(delay)
          return this.fetchAllPages<T>(path, params, attempt + 1)
        }

        throw new InternalServerErrorException(
          `Meta API request failed: ${error?.message ?? 'unknown error'}`,
        )
      }

      const result = json as MetaPaginatedResponse<T>
      const data = result.data ?? []

      if (result.paging?.next) {
        const nextUrl = new URL(result.paging.next)
        const nextParams = Object.fromEntries(nextUrl.searchParams.entries())
        return data.concat(await this.fetchAllPages<T>(path, nextParams, attempt))
      }

      return data
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
