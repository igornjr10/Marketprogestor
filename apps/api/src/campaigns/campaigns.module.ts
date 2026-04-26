import { Module } from '@nestjs/common'
import { CampaignsController } from './campaigns.controller'
import { CampaignsService } from './campaigns.service'
import { CampaignManagementService } from './campaign-management.service'

@Module({
  controllers: [CampaignsController],
  providers: [CampaignsService, CampaignManagementService],
  exports: [CampaignManagementService],
})
export class CampaignsModule {}
