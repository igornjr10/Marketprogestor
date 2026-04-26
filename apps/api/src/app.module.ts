import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AuthModule } from './auth/auth.module'
import { CampaignsModule } from './campaigns/campaigns.module'
import { PrismaModule } from './prisma/prisma.module'
import { ClientsModule } from './clients/clients.module'
import { envSchema } from './config/env.schema'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config) => envSchema.parse(config),
    }),
    PrismaModule,
    AuthModule,
    ClientsModule,
    CampaignsModule,
  ],
})
export class AppModule {}
