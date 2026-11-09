import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { checkRateLimit } from './lib/rate-limiter';
import { buildErrorEnvelope } from './lib/api-response';

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/v1/')) {
    const origin = request.headers.get('origin') || '*';
    const corsHeaders: Record<string, string> = {
      'Access-Control-Allow-Origin': origin === 'null' ? '*' : origin,
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
      'Access-Control-Allow-Credentials': 'true',
    };

    // Handle preflight OPTIONS request for mobile/Android clients
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    // Rate limiting enforcement
    const clientIp =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';

    const rateKey = `${clientIp}:${request.method}:${request.nextUrl.pathname}`;
    if (!checkRateLimit(rateKey, 120, 60_000)) {
      return NextResponse.json(
        buildErrorEnvelope('RATE_LIMITED', 'Rate limit exceeded'),
        {
          status: 429,
          headers: corsHeaders,
        }
      );
    }

    const response = NextResponse.next();
    for (const [key, val] of Object.entries(corsHeaders)) {
      response.headers.set(key, val);
    }
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/v1/:path*'],
};
