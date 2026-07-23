import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'

export default auth((request) => {
  if (!request.auth?.user?.id) {
    const loginUrl = new URL('/api/auth/signin', request.url)
    loginUrl.searchParams.set('callbackUrl', request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  const response = NextResponse.next()
  response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  return response
})

export const config = {
  matcher: ['/admin/:path*'],
}
