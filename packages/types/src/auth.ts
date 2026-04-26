export type UserRole = 'OWNER' | 'ADMIN' | 'ANALYST' | 'VIEWER'

export type JwtPayload = {
  sub: string
  email: string
  tenantId: string
  role: UserRole
  iat?: number
  exp?: number
}

export type AuthTokens = {
  accessToken: string
  refreshToken: string
}

export type RegisterInput = {
  name: string
  email: string
  password: string
  tenantName: string
  tenantSlug: string
}

export type LoginInput = {
  email: string
  password: string
}
