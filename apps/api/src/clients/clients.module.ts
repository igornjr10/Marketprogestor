import { Module } from '@nestjs/common'
import { ClientsController } from './clients.controller'
import { ClientsService } from './clients.service'
import { MetaApiModule } from '../integrations/meta/meta-api.module'

@Module({
  imports: [MetaApiModule],
  controllers: [ClientsController],
  providers: [ClientsService],
})
export class ClientsModule {}
