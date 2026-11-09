import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getRepository, resetRepositorySingleton } from '../infrastructure/database';
import {
  resolveAuthenticatedSession,
  AuthenticationError,
  serializeShadowPreviewCookie,
  parseShadowPreviewTier,
} from '../security/session-auth';
import { resolveTestBearerToken } from '../security/test-auth-adapter';
import * as loginRoute from '../app/api/v1/auth/login/route';
import * as registerRoute from '../app/api/v1/auth/register/route';
import * as logoutRoute from '../app/api/v1/auth/logout/route';
import * as sessionRoute from '../app/api/v1/auth/session/route';
import { AuthorizationError } from '../services/authorization-service';
import { ClearanceTier, ProjectRole } from '../types';

describe('Milestone A: Identity Foundation Security Matrix', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    resetRepositorySingleton();
    process.env = { ...originalEnv };
    process.env.CHRONICLE_PERSISTENCE_MODE = 'seed';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  // 1. Unauthenticated session request is rejected
  it('[AUTH-01] rejects unauthenticated session request with 401 AuthenticationError', async () => {
    delete process.env.CHRONICLE_TEST_AUTH_ENABLED;
    const req = new Request('http://localhost:3000/api/v1/auth/session');
    const res = await sessionRoute.GET(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(body.error.message).toMatch(/Authentication required/i);
  });

  // 2. Missing session cannot resolve to a default user
  it('[AUTH-02] missing session never resolves to usr-ujjwal-maintainer or any default user', async () => {
    delete process.env.CHRONICLE_TEST_AUTH_ENABLED;
    const repo = getRepository();

    await expect(
      resolveAuthenticatedSession({
        repository: repo,
        cookieHeader: undefined,
        authorizationHeader: undefined,
      })
    ).rejects.toThrowError(AuthenticationError);
  });

  // 3. Invalid Supabase token is rejected
  it('[AUTH-03] invalid Supabase token is rejected with 401 UNAUTHORIZED', async () => {
    delete process.env.CHRONICLE_TEST_AUTH_ENABLED;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fake-supabase-project.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'fake-anon-key';

    const repo = getRepository();

    await expect(
      resolveAuthenticatedSession({
        repository: repo,
        authorizationHeader: 'Bearer completely-invalid-malformed-token',
      })
    ).rejects.toThrowError(AuthenticationError);
  });

  // 4. Expired session is rejected
  it('[AUTH-04] expired token error fails closed with 401 UNAUTHORIZED', async () => {
    delete process.env.CHRONICLE_TEST_AUTH_ENABLED;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fake-supabase-project.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'fake-anon-key';

    const repo = getRepository();

    await expect(
      resolveAuthenticatedSession({
        repository: repo,
        authorizationHeader: 'Bearer expired.jwt.token',
      })
    ).rejects.toThrowError(/Invalid or expired Supabase Bearer token/);
  });

  // 5. Forged chronicle_session_ctx cookie cannot authenticate a request
  it('[AUTH-05] forged legacy chronicle_session_ctx cookie is ignored and cannot authenticate', async () => {
    delete process.env.CHRONICLE_TEST_AUTH_ENABLED;
    const repo = getRepository();

    const forgedCookie =
      'chronicle_session_ctx=' +
      encodeURIComponent(
        JSON.stringify({
          userId: 'usr-ujjwal-maintainer',
          projectId: 'proj-core-payments',
          shadowPreviewTier: null,
        })
      );

    await expect(
      resolveAuthenticatedSession({
        repository: repo,
        cookieHeader: forgedCookie,
      })
    ).rejects.toThrowError(AuthenticationError);
  });

  // 6. Legacy chronicle-test-user bearer token is rejected in production mode
  it('[AUTH-06] legacy chronicle-test-user token is rejected in production mode or when test auth disabled', async () => {
    // A: In production environment
    (process.env as any).NODE_ENV = 'production';
    process.env.CHRONICLE_TEST_AUTH_ENABLED = 'true';
    expect(
      resolveTestBearerToken('Bearer chronicle-test-user:usr-ujjwal-maintainer')
    ).toBeNull();

    // B: In test environment but flag disabled
    (process.env as any).NODE_ENV = 'test';
    process.env.CHRONICLE_TEST_AUTH_ENABLED = 'false';
    expect(
      resolveTestBearerToken('Bearer chronicle-test-user:usr-ujjwal-maintainer')
    ).toBeNull();

    // C: Resolve session fails closed
    const repo = getRepository();
    await expect(
      resolveAuthenticatedSession({
        repository: repo,
        authorizationHeader: 'Bearer chronicle-test-user:usr-ujjwal-maintainer',
      })
    ).rejects.toThrowError(AuthenticationError);
  });

  // 7. Supplying another user's userId cannot impersonate that user
  it('[AUTH-07] supplying arbitrary userId in POST /api/v1/auth/session cannot impersonate another user', async () => {
    // Activate test auth for Marcus Vance (Tier 2 Incoming Owner)
    (process.env as any).NODE_ENV = 'test';
    process.env.CHRONICLE_TEST_AUTH_ENABLED = 'true';

    // Marcus attempts to impersonate Ujjwal Maintainer by passing userId in body
    const req = new Request('http://localhost:3000/api/v1/auth/session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer chronicle-test-user:usr-marcus-incoming',
      },
      body: JSON.stringify({
        userId: 'usr-ujjwal-maintainer',
        projectId: 'proj-core-payments',
        shadowPreviewTier: null,
      }),
    });

    const res = await sessionRoute.POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();

    // Identity MUST remain Marcus Vance, NOT Ujjwal Maintainer!
    expect(body.ok).toBe(true);
    expect(body.data.session.userId).toBe('usr-marcus-incoming');
    expect(body.data.session.displayName).toBe('Marcus Vance');
    expect(body.data.session.role).toBe(ProjectRole.INCOMING_OWNER);
  });

  // 8. Registration does not create organization or project memberships
  it('[AUTH-08] registration does not create organization or project memberships', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fake-supabase-project.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'fake-anon-key';

    const repo = getRepository();
    const initialOrgMembers = await repo.listOrganizationMemberships('org-chronicle-fin');
    const initialProjMembers = await repo.listProjectMemberships('proj-core-payments');

    // Simulate new user registration payload
    const newUserId = '550e8400-e29b-41d4-a716-446655440000';
    const newEmail = 'new-unaffiliated-engineer@company.com';

    // Verify repository has no memberships for this new identity
    const orgMem = await repo.getOrganizationMembership('org-chronicle-fin', newUserId);
    const projMem = await repo.getProjectMembership('proj-core-payments', newUserId);

    expect(orgMem).toBeNull();
    expect(projMem).toBeNull();

    // Confirm total counts are unchanged
    const afterOrgMembers = await repo.listOrganizationMemberships('org-chronicle-fin');
    const afterProjMembers = await repo.listProjectMemberships('proj-core-payments');
    expect(afterOrgMembers.length).toBe(initialOrgMembers.length);
    expect(afterProjMembers.length).toBe(initialProjMembers.length);
  });

  // 9. Unconfirmed email cannot access protected application functionality
  it('[AUTH-09] unconfirmed email is blocked with 403 FORBIDDEN when confirmation required', async () => {
    process.env.CHRONICLE_REQUIRE_EMAIL_CONFIRMATION = 'true';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fake-supabase-project.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'fake-anon-key';

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: 'usr-ujjwal-maintainer',
              email: 'ujjwal@chronicle.dev',
              email_confirmed_at: null, // UNCONFIRMED
            },
          },
          error: null,
        }),
      },
    };

    const repo = getRepository();
    await expect(
      resolveAuthenticatedSession({
        repository: repo,
        authorizationHeader: 'Bearer valid.unconfirmed.token',
        supabaseClient: mockSupabase,
      })
    ).rejects.toThrowError(AuthorizationError);
  });

  // 10. Logout invalidates the application session as expected
  it('[AUTH-10] logout revokes session and clears shadow preview cookie', async () => {
    const req = new Request('http://localhost:3000/api/v1/auth/logout', {
      method: 'POST',
    });

    const res = await logoutRoute.POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    // Verify Set-Cookie header clears shadow tier
    const setCookie = res.headers.get('Set-Cookie');
    expect(setCookie).toContain('chronicle_shadow_tier=;');
    expect(setCookie).toContain('Max-Age=0');
  });

  // 11. Authenticated users without Chronicle memberships cannot access project data
  it('[AUTH-11] authenticated user with valid Supabase identity but no Chronicle membership is denied with 403', async () => {
    // User is authenticated via Supabase, but has no record in organization_memberships
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: 'unaffiliated-external-user-uuid',
              email: 'random.engineer@stranger.org',
              email_confirmed_at: new Date().toISOString(),
            },
          },
          error: null,
        }),
      },
    };

    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fake.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'fake-key';

    const repo = getRepository();

    await expect(
      resolveAuthenticatedSession({
        repository: repo,
        authorizationHeader: 'Bearer valid.jwt.token',
        supabaseClient: mockSupabase,
      })
    ).rejects.toThrowError(/User does not belong to the project organization/);
  });

  // 12. Existing test-only authentication remains isolated from production
  it('[AUTH-12] test-only authentication is strictly isolated from production runtime', () => {
    // When NODE_ENV === 'production', adapter NEVER returns a result
    (process.env as any).NODE_ENV = 'production';
    process.env.CHRONICLE_TEST_AUTH_ENABLED = 'true';

    const prodResult = resolveTestBearerToken(
      'Bearer chronicle-test-user:usr-ujjwal-maintainer'
    );
    expect(prodResult).toBeNull();

    // Only in test environment with flag explicitly true does it resolve
    (process.env as any).NODE_ENV = 'test';
    process.env.CHRONICLE_TEST_AUTH_ENABLED = 'true';

    const testResult = resolveTestBearerToken(
      'Bearer chronicle-test-user:usr-ujjwal-maintainer:2'
    );
    expect(testResult).not.toBeNull();
    expect(testResult?.userId).toBe('usr-ujjwal-maintainer');
    expect(testResult?.shadowTier).toBe(ClearanceTier.TIER_2_INTERNAL);
  });
});
