import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/register']

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl
  const accessToken = request.cookies.get('access_token')?.value

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p))

  if (!isPublic && !accessToken) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (isPublic && accessToken) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
