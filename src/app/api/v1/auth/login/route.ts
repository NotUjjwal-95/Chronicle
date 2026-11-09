import { NextResponse } from 'next/server';
import { createServerClient, parseCookieHeader } from '@supabase/ssr';
import { LoginRequestSchema } from '../../../../../schemas/api-v1-schemas';
import { buildErrorEnvelope, buildSuccessEnvelope } from '../../../../../lib/api-response';
import { handleRouteError } from '../../../../../lib/route-helper';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = LoginRequestSchema.parse(body);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        buildErrorEnvelope(
          'PERSISTENCE_UNAVAILABLE',
          'Supabase Auth is not configured'
        ),
        { status: 503 }
      );
    }

    const pendingCookies: { name: string; value: string; options: any }[] = [];

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

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      return NextResponse.json(
        buildErrorEnvelope('UNAUTHORIZED', error?.message || 'Invalid credentials'),
        { status: 401 }
      );
    }

    // Email confirmation verification gate
    if (
      process.env.CHRONICLE_REQUIRE_EMAIL_CONFIRMATION === 'true' &&
      !data.user.email_confirmed_at
    ) {
      return NextResponse.json(
        buildErrorEnvelope(
          'FORBIDDEN',
          'Email address has not been confirmed'
        ),
        { status: 403 }
      );
    }

    const response = NextResponse.json(
      buildSuccessEnvelope(
        {
          user: {
            id: data.user.id,
            email: data.user.email,
          },
          session: {
            expiresAt: data.session?.expires_at,
          },
        },
        {
          projectId: 'none',
          effectiveTier: 1,
          persistenceMode: 'supabase',
        }
      )
    );

    for (const { name, value, options } of pendingCookies) {
      response.cookies.set(name, value, options);
    }

    return response;
  } catch (err) {
    return handleRouteError(err);
  }
}

