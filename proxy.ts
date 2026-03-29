import { clerkMiddleware, auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export default clerkMiddleware(async (auth, req) => {
  // Protect /premium route - redirect unauthenticated users to sign in
  if (req.nextUrl.pathname.startsWith('/premium')) {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.redirect(new URL('/signin', req.url))
    }
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
