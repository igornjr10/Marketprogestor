import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common'
import { Observable, of } from 'rxjs'
import { tap } from 'rxjs/operators'
import { CacheService } from '../../cache/cache.service'

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly cache: CacheService) {}

  async intercept(ctx: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const req = ctx.switchToHttp().getRequest<{ headers: Record<string, string> }>()
    const key = req.headers['idempotency-key']
    if (!key) return next.handle()

    const cacheKey = `idempotency:${key}`
    const cached = await this.cache.get<unknown>(cacheKey)
    if (cached !== null) return of(cached)

    return next.handle().pipe(
      tap(async (data) => {
        await this.cache.set(cacheKey, data, 3600)
      }),
    )
  }
}
