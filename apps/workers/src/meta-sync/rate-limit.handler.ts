import { Injectable, Logger } from '@nestjs/common'
import Redis from 'ioredis'

const RATE_LIMIT_CODES = new Set([4, 17, 32, 613])
const COOL_DOWN_MS = 5 * 60 * 1000 // 5 minutes

@Injectable()
export class RateLimitHandler {
  private readonly logger = new Logger(RateLimitHandler.name)
  private readonly redis: Redis

  constructor() {
    this.redis = new Redis({
      host: process.env['REDIS_HOST'] ?? 'localhost',
      port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
    })
  }

  async shouldThrottle(headers: Record<string, string>): Promise<boolean> {
    const usage = this.parseUsage(headers)
    if (!usage) return false

    const isHighUsage = usage.business >= 80 || usage.app >= 80
    if (isHighUsage) {
      this.logger.warn(`High API usage detected: business=${usage.business}%, app=${usage.app}%`)
      await this.setCoolDown()
      return true
    }

    return false
  }

  async isInCoolDown(): Promise<boolean> {
    const coolDownUntil = await this.redis.get('meta_api_cooldown')
    if (!coolDownUntil) return false

    const now = Date.now()
    const until = parseInt(coolDownUntil, 10)
    return now < until
  }

  private async setCoolDown(): Promise<void> {
    const until = Date.now() + COOL_DOWN_MS
    await this.redis.set('meta_api_cooldown', until.toString(), 'PX', COOL_DOWN_MS)
    this.logger.warn(`API rate limit triggered, cooling down until ${new Date(until).toISOString()}`)
  }

  private parseUsage(headers: Record<string, string>): { business: number; app: number } | null {
    const businessUsage = headers['x-business-use-case-usage']
    const appUsage = headers['x-app-usage']

    if (!businessUsage || !appUsage) return null

    // Parse format like "1000/250000 (0%)"
    const businessMatch = businessUsage.match(/\((\d+)%\)/)
    const appMatch = appUsage.match(/\((\d+)%\)/)

    if (!businessMatch || !appMatch) return null

    return {
      business: parseInt(businessMatch[1], 10),
      app: parseInt(appMatch[1], 10),
    }
  }
}