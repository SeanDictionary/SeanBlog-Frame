import NextAuth from 'next-auth'
import { NextResponse } from 'next/server'

import { authConfig } from '@/lib/auth.config'

const { auth } = NextAuth(authConfig)

export default auth((request) => {
  if (!request.auth?.user?.id) {
    const loginUrl = new URL('/login', request.url)
    const callbackUrl = `${request.nextUrl.pathname}${request.nextUrl.search}`
    loginUrl.searchParams.set('callbackUrl', callbackUrl)
    return NextResponse.redirect(loginUrl)
  }

  const response = NextResponse.next()
  response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  return response
})

export const config = {
  matcher: ['/admin/:path*'],
}
