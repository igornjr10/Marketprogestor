import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Redis from 'ioredis'
import type { Env } from '../config/env.schema'

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private redis!: Redis

  constructor(private readonly config: ConfigService<Env>) {}

  async onModuleInit() {
    const raw = this.config.get('REDIS_URL') ?? 'redis://localhost:6379'
    const url = new URL(raw)
    this.redis = new Redis({
      host: url.hostname,
      port: parseInt(url.port || '6379', 10),
      lazyConnect: true,
    })
    await this.redis.connect()
  }

  async onModuleDestroy() {
    await this.redis.quit()
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds)
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key)
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern)
    if (keys.length > 0) {
      await this.redis.del(keys)
    }
  }

  async withCache<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key)
    if (cached !== null) return cached
    const result = await fn()
    await this.set(key, result, ttlSeconds)
    return result
  }
}
