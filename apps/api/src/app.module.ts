import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
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
    PrismaModule,
    CacheModule,
    AuthModule,
    ClientsModule,
    CampaignsModule,
    AnalyticsModule,
  ],
})
export class AppModule {}
