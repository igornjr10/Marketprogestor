import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import * as argon2 from 'argon2'
import { PrismaService } from '../prisma/prisma.service'
import type { RegisterDto } from './dto/register.dto'
import type { LoginDto } from './dto/login.dto'
import type { AuthTokens, JwtPayload } from '@marketproads/types'
import type { Env } from '../config/env.schema'

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env>,
  ) {}

  async register(dto: RegisterDto): Promise<AuthTokens> {
    const existingTenant = await this.prisma.rawClient.tenant.findUnique({
      where: { slug: dto.tenantSlug },
    })
    if (existingTenant) throw new ConflictException('Slug já está em uso')

    const passwordHash = await argon2.hash(dto.password)

    const tenant = await this.prisma.rawClient.tenant.create({
      data: {
        name: dto.tenantName,
        slug: dto.tenantSlug,
        users: {
          create: {
            name: dto.name,
            email: dto.email,
            passwordHash,
            role: 'OWNER',
          },
        },
      },
      include: { users: true },
    })

    const user = tenant.users[0]
    if (!user) throw new Error('Falha ao criar usuário')

    return this.generateTokens(user.id, user.email, tenant.id, 'OWNER')
  }

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string): Promise<AuthTokens> {
    const user = await this.prisma.rawClient.user.findFirst({
      where: { email: dto.email },
      include: { tenant: true },
    })

    if (!user) throw new UnauthorizedException('Credenciais inválidas')

    const passwordValid = await argon2.verify(user.passwordHash, dto.password)
    if (!passwordValid) throw new UnauthorizedException('Credenciais inválidas')

    const tokens = await this.generateTokens(user.id, user.email, user.tenantId, user.role)

    await this.prisma.rawClient.session.create({
      data: {
        userId: user.id,
        refreshToken: tokens.refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        ipAddress,
        userAgent,
      },
    })

    return tokens
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const session = await this.prisma.rawClient.session.findUnique({
      where: { refreshToken },
      include: { user: true },
    })

    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token inválido ou expirado')
    }

    await this.prisma.rawClient.session.delete({ where: { id: session.id } })

    const { user } = session
    const tokens = await this.generateTokens(user.id, user.email, user.tenantId, user.role)

    await this.prisma.rawClient.session.create({
      data: {
        userId: user.id,
        refreshToken: tokens.refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })

    return tokens
  }

  async logout(refreshToken: string): Promise<void> {
    const session = await this.prisma.rawClient.session.findUnique({ where: { refreshToken } })
    if (!session) throw new NotFoundException('Sessão não encontrada')
    await this.prisma.rawClient.session.delete({ where: { id: session.id } })
  }

  private async generateTokens(
    userId: string,
    email: string,
    tenantId: string,
    role: JwtPayload['role'],
  ): Promise<AuthTokens> {
    const payload: JwtPayload = { sub: userId, email, tenantId, role }

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload),
      this.jwt.signAsync(payload, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN'),
      }),
    ])

    return { accessToken, refreshToken }
  }
}
