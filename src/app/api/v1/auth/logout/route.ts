import { NextResponse } from 'next/server';
import { createServerClient, parseCookieHeader } from '@supabase/ssr';
import { buildSuccessEnvelope } from '../../../../../lib/api-response';
import { serializeShadowPreviewCookie } from '../../../../../security/session-auth';

export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const pendingCookies: { name: string; value: string; options: any }[] = [];

  if (supabaseUrl && supabaseAnonKey) {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return parseCookieHeader(req.headers.get('cookie') ?? '');
        },
        setAll(cookiesToSet) {
          pendingCookies.push(...cookiesToSet);
        },
      },
    });

    await supabase.auth.signOut();
  }

  const response = NextResponse.json(
    buildSuccessEnvelope(
      { message: 'Logged out successfully' },
      { projectId: 'none', effectiveTier: 1, persistenceMode: 'supabase' }
    )
  );

  for (const { name, value, options } of pendingCookies) {
    response.cookies.set(name, value, options);
  }

  // Clear shadow preview cookie
  response.headers.append('Set-Cookie', serializeShadowPreviewCookie(null));

  return response;
}

