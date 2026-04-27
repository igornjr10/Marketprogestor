import { Module } from '@nestjs/common'
import { CampaignsController } from './campaigns.controller'
import { CampaignsService } from './campaigns.service'
import { CampaignManagementService } from './campaign-management.service'
import { MetaApiModule } from '../integrations/meta/meta-api.module'

@Module({
  imports: [MetaApiModule],
  controllers: [CampaignsController],
  providers: [CampaignsService, CampaignManagementService],
  exports: [CampaignManagementService],
})
export class CampaignsModule {}
