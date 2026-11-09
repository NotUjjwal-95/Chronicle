import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { checkRateLimit } from './lib/rate-limiter';
import { buildErrorEnvelope } from './lib/api-response';
import { updateSession } from './lib/supabase/middleware';

const PUBLIC_API_PATHS = [
  '/api/v1/health',
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/auth/logout',
];

const PUBLIC_PAGE_PATHS = [
  '/login',
  '/register',
  '/auth/callback',
];

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // 1. Process Supabase SSR session token refresh across all matched paths
  const { response: sessionResponse, user } = await updateSession(request);

  // 2. Handle /api/v1/* routes
  if (pathname.startsWith('/api/v1/')) {
    const origin = request.headers.get('origin') || '*';
    const corsHeaders: Record<string, string> = {
      'Access-Control-Allow-Origin': origin === 'null' ? '*' : origin,
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie, X-Chronicle-Shadow-Tier',
      'Access-Control-Allow-Credentials': 'true',
    };

    // Preflight OPTIONS for mobile / Android clients
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    // IP Rate limiting enforcement
    const clientIp =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';

    const rateKey = `${clientIp}:${request.method}:${pathname}`;
    if (!checkRateLimit(rateKey, 120, 60_000)) {
      return NextResponse.json(
        buildErrorEnvelope('RATE_LIMITED', 'Rate limit exceeded'),
        {
          status: 429,
          headers: corsHeaders,
        }
      );
    }

    // Apply CORS headers to session response
    for (const [key, val] of Object.entries(corsHeaders)) {
      sessionResponse.headers.set(key, val);
    }

    return sessionResponse;
  }

  // 3. Handle protected web page routes (/dashboard, /projects/*)
  const isPublicPage = PUBLIC_PAGE_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  // If user is unauthenticated and attempting to access a protected page, redirect to /login
  if (!user && !isPublicPage && (pathname === '/' || pathname.startsWith('/dashboard') || pathname.startsWith('/projects'))) {
    // Check if test bypass is active in test environment
    if (
      process.env.NODE_ENV === 'test' &&
      process.env.CHRONICLE_TEST_AUTH_ENABLED === 'true'
    ) {
      return sessionResponse;
    }

    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    if (pathname !== '/') {
      redirectUrl.searchParams.set('next', pathname);
    }
    return NextResponse.redirect(redirectUrl);
  }

  return sessionResponse;
}

export const config = {
  matcher: [
    '/api/v1/:path*',
    '/',
    '/dashboard/:path*',
    '/projects/:path*',
    '/login',
    '/register',
    '/auth/callback',
  ],
};
