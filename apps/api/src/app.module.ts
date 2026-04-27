import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ThrottlerModule } from '@nestjs/throttler'
import { AuthModule } from './auth/auth.module'
import { CampaignsModule } from './campaigns/campaigns.module'
import { PrismaModule } from './prisma/prisma.module'
import { ClientsModule } from './clients/clients.module'
import { CacheModule } from './cache/cache.module'
import { AnalyticsModule } from './analytics/analytics.module'
import { envSchema } from './config/env.schema'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config) => envSchema.parse(config),
    }),
    ThrottlerModule.forRoot([{ name: 'mutations', ttl: 60000, limit: 30 }]),
    PrismaModule,
    CacheModule,
    AuthModule,
    ClientsModule,
    CampaignsModule,
    AnalyticsModule,
  ],
})
export class AppModule {}
