import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { ClientsService } from './clients.service'
import { JwtGuard } from '../auth/guards/jwt.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { createClientSchema } from './dto/create-client.dto'
import { finalizeMetaSchema } from './dto/finalize-meta.dto'
import type { JwtPayload } from '@marketproads/types'

@Controller('clients')
@UseGuards(JwtGuard)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.clientsService.findAll(user.tenantId)
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() body: unknown) {
    const dto = createClientSchema.parse(body)
    return this.clientsService.create(user.tenantId, dto)
  }

  @Get(':id')
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.clientsService.findOne(user.tenantId, id)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.clientsService.remove(user.tenantId, id)
  }

  @Get(':id/meta/connect-url')
  getConnectUrl(@Param('id') id: string) {
    return { url: this.clientsService.buildConnectUrl(id) }
  }

  @Get(':id/meta/callback')
  handleCallback(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query('code') code: string,
  ) {
    return this.clientsService.handleCallback(user.tenantId, id, code)
  }

  @Post(':id/meta/finalize')
  finalizeConnection(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const dto = finalizeMetaSchema.parse(body)
    return this.clientsService.finalizeConnection(user.tenantId, id, dto)
  }

  @Get(':id/meta/health')
  checkHealth(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.clientsService.checkHealth(user.tenantId, id)
  }

  @Delete(':id/meta')
  @HttpCode(HttpStatus.NO_CONTENT)
  disconnect(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.clientsService.disconnect(user.tenantId, id)
  }
}
