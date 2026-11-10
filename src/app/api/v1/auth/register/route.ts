import { NextResponse } from 'next/server';
import { createServerClient, parseCookieHeader } from '@supabase/ssr';
import { RegisterRequestSchema } from '../../../../../schemas/api-v1-schemas';
import { buildErrorEnvelope, buildSuccessEnvelope } from '../../../../../lib/api-response';
import { handleRouteError } from '../../../../../lib/route-helper';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, displayName } = RegisterRequestSchema.parse(body);

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

    // Milestone A: Register creates a Supabase Auth identity only.
    // It MUST NOT grant organization or project memberships automatically.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
        },
      },
    });

    if (error) {
      return NextResponse.json(
        buildErrorEnvelope('VALIDATION_ERROR', error.message),
        { status: 400 }
      );
    }

    if (!data.user) {
      return NextResponse.json(
        buildErrorEnvelope('INTERNAL_ERROR', 'User creation failed'),
        { status: 500 }
      );
    }

    const response = NextResponse.json(
      buildSuccessEnvelope(
        {
          user: {
            id: data.user.id,
            email: data.user.email,
          },
          emailConfirmationRequired: !data.user.email_confirmed_at,
          message: data.user.email_confirmed_at
            ? 'Account registered successfully.'
            : 'Registration initiated. Please check your email for confirmation instructions.',
        },
        {
          projectId: 'none',
          effectiveTier: 1,
          persistenceMode: 'supabase',
        }
      ),
      { status: 201 }
    );

    for (const { name, value, options } of pendingCookies) {
      response.cookies.set(name, value, options);
    }

    return response;
  } catch (err) {
    return handleRouteError(err);
  }
}
