import { createClient } from '@supabase/supabase-js';
import { AuthenticatedSession, ClearanceTier } from '../types';
import { IChronicleRepository } from '../infrastructure/database/repository-interface';
import { resolveEffectiveClearanceTier } from './clearance-policy';
import { AuthorizationError } from '../services/authorization-service';
import { createClientFromCookieHeader } from '../lib/supabase/server';
import { resolveTestBearerToken } from './test-auth-adapter';

export class AuthenticationError extends Error {
  public readonly code = 'UNAUTHORIZED' as const;
  public readonly statusCode = 401;

  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export const SHADOW_PREVIEW_COOKIE_NAME = 'chronicle_shadow_tier';

/**
 * Parses the downgrade-only shadow preview tier from cookies or headers.
 * Contains only a numerical tier (1 or 2); never contains user IDs or roles.
 */
export function parseShadowPreviewTier(
  cookieHeader?: string,
  shadowHeader?: string
): ClearanceTier | null {
  if (shadowHeader) {
    const val = Number(shadowHeader);
    if (val === 1 || val === 2) {
      return val as ClearanceTier;
    }
  }

  if (cookieHeader) {
    const cookies = cookieHeader.split(';').map((part) => part.trim());
    for (const part of cookies) {
      if (part.startsWith(`${SHADOW_PREVIEW_COOKIE_NAME}=`)) {
        const val = Number(part.slice(SHADOW_PREVIEW_COOKIE_NAME.length + 1));
        if (val === 1 || val === 2) {
          return val as ClearanceTier;
        }
      }
    }
  }

  return null;
}

export function serializeShadowPreviewCookie(tier: ClearanceTier | null): string {
  if (tier === null) {
    return `${SHADOW_PREVIEW_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
  }
  return `${SHADOW_PREVIEW_COOKIE_NAME}=${tier}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`;
}

/**
 * Resolves the server-verified authenticated session.
 *
 * Security Invariants:
 * 1. Supabase Auth is the sole production identity provider.
 * 2. Unauthenticated requests fail closed with AuthenticationError (401).
 * 3. Never defaults to a mock or hardcoded identity.
 * 4. Never accepts client-supplied user IDs, roles, or clearance tiers.
 * 5. Test token bypass is strictly isolated to NODE_ENV === 'test' and CHRONICLE_TEST_AUTH_ENABLED === 'true'.
 * 6. Shadow preview is strictly downgrade-only, accessible solely to verified Tier 3 Maintainers.
 */
export async function resolveAuthenticatedSession(params: {
  repository: IChronicleRepository;
  cookieHeader?: string;
  authorizationHeader?: string;
  shadowHeader?: string;
  targetProjectId?: string;
  supabaseClient?: any;
}): Promise<AuthenticatedSession> {
  const {
    repository,
    cookieHeader,
    authorizationHeader,
    shadowHeader,
    targetProjectId,
    supabaseClient,
  } = params;

  let resolvedUserId: string | null = null;
  let userEmail: string | null = null;
  let requestedShadowTier: ClearanceTier | null = parseShadowPreviewTier(
    cookieHeader,
    shadowHeader
  );
  const defaultProjectId = targetProjectId || 'proj-core-payments';

  // 1. Check test-only adapter (isolated strictly to test execution)
  const testAuth = resolveTestBearerToken(authorizationHeader);
  if (testAuth) {
    resolvedUserId = testAuth.userId;
    if (testAuth.shadowTier) {
      requestedShadowTier = testAuth.shadowTier;
    }
  }

  // 2. Production: Check Bearer token if provided (Supabase Auth JWT)
  if (!resolvedUserId && authorizationHeader && authorizationHeader.startsWith('Bearer ')) {
    const token = authorizationHeader.slice('Bearer '.length).trim();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new AuthenticationError('Authentication service unavailable');
    }

    const supabase =
      supabaseClient ??
      createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false },
      });
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      throw new AuthenticationError('Invalid or expired Supabase Bearer token');
    }

    // Email confirmation enforcement
    if (
      process.env.CHRONICLE_REQUIRE_EMAIL_CONFIRMATION === 'true' &&
      !data.user.email_confirmed_at
    ) {
      throw new AuthorizationError(
        'FORBIDDEN',
        'Email address has not been confirmed',
        403
      );
    }

    resolvedUserId = data.user.id;
    userEmail = data.user.email ?? null;
  }

  // 3. Production: Check official Supabase SSR HttpOnly cookies
  if (!resolvedUserId && cookieHeader) {
    const supabase = createClientFromCookieHeader(cookieHeader);
    if (supabase) {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data.user) {
        if (
          process.env.CHRONICLE_REQUIRE_EMAIL_CONFIRMATION === 'true' &&
          !data.user.email_confirmed_at
        ) {
          throw new AuthorizationError(
            'FORBIDDEN',
            'Email address has not been confirmed',
            403
          );
        }

        resolvedUserId = data.user.id;
        userEmail = data.user.email ?? null;
      }
    }
  }

  // 4. Fail-closed: An unauthenticated request must NEVER resolve to a default user
  if (!resolvedUserId) {
    throw new AuthenticationError('Authentication required');
  }

  // 5. Server-side verification against organization and project membership records
  const project = await repository.getProjectById(defaultProjectId);
  if (!project) {
    throw new AuthorizationError('NOT_FOUND', 'Requested project does not exist', 404);
  }

  const orgMembership = await repository.getOrganizationMembership(
    project.organizationId,
    resolvedUserId
  );
  if (!orgMembership) {
    throw new AuthorizationError(
      'FORBIDDEN',
      'User does not belong to the project organization',
      403
    );
  }

  const projectMembership = await repository.getProjectMembership(
    project.id,
    resolvedUserId
  );
  if (!projectMembership) {
    throw new AuthorizationError(
      'FORBIDDEN',
      'User does not have membership in the requested project',
      403
    );
  }

  const actualClearanceTier = Math.min(
    orgMembership.maxClearanceTier,
    projectMembership.clearanceTier
  ) as ClearanceTier;

  const { effectiveClearanceTier, isShadowPreview } = resolveEffectiveClearanceTier({
    role: projectMembership.role,
    actualClearanceTier,
    requestedShadowTier,
  });

  return {
    userId: resolvedUserId,
    email: orgMembership.email || userEmail || '',
    displayName: orgMembership.displayName,
    organizationId: project.organizationId,
    projectId: project.id,
    role: projectMembership.role,
    actualClearanceTier,
    shadowPreviewTier: isShadowPreview ? effectiveClearanceTier : null,
    effectiveClearanceTier,
    isShadowPreview,
  };
}
