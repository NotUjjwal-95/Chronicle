import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { type NextRequest } from 'next/server';
import {
  validateRedirectPath,
  getCanonicalAppOrigin,
} from '../../../lib/redirect-validator';

/**
 * Authentication Callback Handler
 *
 * Exchanges Supabase auth code for an authenticated session and redirects
 * to a validated, relative application destination.
 *
 * Environment Configuration:
 * - `APP_URL`: Sole authoritative canonical application origin.
 *   Expected format: Absolute HTTP or HTTPS URL (e.g. "http://localhost:3000" in local dev,
 *   or "https://chronicle.example.com" in production). No credentials, path, query, or fragment.
 *
 * Security Invariants:
 * 1. Requires valid canonical origin configuration; fails closed to 500 error response if missing/invalid.
 * 2. Validates incoming request URL and Host / X-Forwarded-Host headers against canonical origin;
 *    fails closed to a 400 Bad Request local response on origin/host mismatch (prevents host header poisoning).
 * 3. Sanitizes the `next` redirect destination via `validateRedirectPath` to guarantee a relative path.
 * 4. Reconstructs all redirect responses exclusively against the verified canonical origin.
 */

export async function GET(request: NextRequest) {
  const canonicalOrigin = getCanonicalAppOrigin();
  if (!canonicalOrigin) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'CONFIGURATION_ERROR',
          message:
            'Canonical application origin is not configured. Set APP_URL to a valid absolute HTTP/HTTPS URL.',
        },
      },
      { status: 500 }
    );
  }

  const canonicalUrl = new URL(canonicalOrigin);
  const canonicalHost = canonicalUrl.host.toLowerCase();

  // Validate incoming request URL origin
  let requestOrigin: string;
  try {
    requestOrigin = new URL(request.url).origin.toLowerCase();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Malformed request URL.',
        },
      },
      { status: 400 }
    );
  }

  if (requestOrigin !== canonicalOrigin.toLowerCase()) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'ORIGIN_MISMATCH',
          message:
            'Authentication callback request origin does not match configured canonical application origin.',
        },
      },
      { status: 400 }
    );
  }

  // Validate incoming Host header if provided
  const hostHeader = request.headers.get('host');
  if (hostHeader && hostHeader.trim().toLowerCase() !== canonicalHost) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'ORIGIN_MISMATCH',
          message:
            'Authentication callback Host header does not match configured canonical application host.',
        },
      },
      { status: 400 }
    );
  }

  // Validate X-Forwarded-Host if provided
  const forwardedHostHeader = request.headers.get('x-forwarded-host');
  if (forwardedHostHeader && forwardedHostHeader.trim().toLowerCase() !== canonicalHost) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'ORIGIN_MISMATCH',
          message:
            'Authentication callback X-Forwarded-Host header does not match configured canonical application host.',
        },
      },
      { status: 400 }
    );
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next');
  const safeNext = validateRedirectPath(next, '/dashboard', canonicalOrigin);

  if (code) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseAnonKey) {
      const response = NextResponse.redirect(new URL(safeNext, canonicalOrigin));

      const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      });

      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return response;
      }
    }
  }

  // Return to login with error if verification failed, anchored strictly to canonicalOrigin
  return NextResponse.redirect(
    new URL('/login?error=email_verification_failed', canonicalOrigin)
  );
}