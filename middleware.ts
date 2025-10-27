import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Public routes that don't require authentication
  const publicRoutes = [
    '/',
    '/api/login',
    '/api/logout',
    '/api/auth',
    '/sheets',
    '/plans',
    '/ingest-plans',
    '/tickets'
  ]
  
  // Check if the current path is public
  const isPublicRoute = publicRoutes.some(route => {
    if (route === '/') {
      return pathname === '/'
    }
    if (route === '/api/auth') {
      return pathname.startsWith('/api/auth')
    }
    if (route === '/sheets') {
      return pathname.startsWith('/sheets')
    }
    return pathname.startsWith(route)
  })
  
  // If it's a public route, allow access
  if (isPublicRoute) {
    return NextResponse.next()
  }
  
  // Check for authentication cookie/session
  const sessionCookie = request.cookies.get('next-auth.session-token') || 
                       request.cookies.get('__Secure-next-auth.session-token') ||
                       request.cookies.get('dev-session') // Add development session support
  
  // If no session found, redirect to login
  if (!sessionCookie) {
    const loginUrl = new URL('/api/login', request.url)
    return NextResponse.redirect(loginUrl)
  }
  
  // If authenticated, allow access
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
}
