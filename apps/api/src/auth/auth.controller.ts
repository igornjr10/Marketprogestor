import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus, Req } from '@nestjs/common'
import { AuthService } from './auth.service'
import { registerSchema, type RegisterDto } from './dto/register.dto'
import { loginSchema, type LoginDto } from './dto/login.dto'
import { refreshSchema, type RefreshDto } from './dto/refresh.dto'
import { JwtGuard } from './guards/jwt.guard'
import { CurrentUser } from './decorators/current-user.decorator'
import type { JwtPayload } from '@marketproads/types'

type FastifyRequest = {
  ip: string
  headers: Record<string, string>
  body: unknown
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() body: unknown) {
    const dto: RegisterDto = registerSchema.parse(body)
    return this.authService.register(dto)
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: unknown, @Req() req: FastifyRequest) {
    const dto: LoginDto = loginSchema.parse(body)
    return this.authService.login(dto, req.ip, req.headers['user-agent'])
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() body: unknown) {
    const { refreshToken }: RefreshDto = refreshSchema.parse(body)
    return this.authService.refresh(refreshToken)
  }

  @Post('logout')
  @UseGuards(JwtGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() body: unknown, @CurrentUser() _user: JwtPayload) {
    const { refreshToken }: RefreshDto = refreshSchema.parse(body)
    await this.authService.logout(refreshToken)
  }
}
