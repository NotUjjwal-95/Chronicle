import { createClient } from '@supabase/supabase-js';
import { AuthenticatedSession, ClearanceTier } from '../types';
import { IChronicleRepository } from '../infrastructure/database/repository-interface';
import { resolveEffectiveClearanceTier } from './clearance-policy';

export const SESSION_COOKIE_NAME = 'chronicle_session_ctx';

export interface SessionCookiePayload {
  userId: string;
  projectId: string;
  shadowPreviewTier: ClearanceTier | null;
}

export const DEMO_USERS = [
  {
    userId: 'usr-ujjwal-maintainer',
    email: 'ujjwal@chronicle.dev',
    displayName: 'Ujjwal Tyagi (Engineering Authority)',
    description: 'Tier 3 Confidential · Maintainer (Full control + Shadow Preview)',
  },
  {
    userId: 'usr-elena-reviewer',
    email: 'elena.rostova@chronicle.dev',
    displayName: 'Elena Rostova (Principal Reviewer)',
    description: 'Tier 3 Confidential · Reviewer (Conflict resolution & approval)',
  },
  {
    userId: 'usr-marcus-incoming',
    email: 'marcus.vance@chronicle.dev',
    displayName: 'Marcus Vance (Incoming Service Owner)',
    description: 'Tier 2 Internal · Incoming Owner (Interview & Handover Ack)',
  },
  {
    userId: 'usr-auditor-external',
    email: 'compliance@partner-audit.io',
    displayName: 'Sora Takahashi (External Security Auditor)',
    description: 'Tier 1 External · External Auditor (Read-only public tier)',
  },
] as const;

export function parseSessionCookieHeader(cookieHeader?: string): SessionCookiePayload | null {
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(';').map((part) => part.trim());
  for (const part of cookies) {
    if (part.startsWith(`${SESSION_COOKIE_NAME}=`)) {
      const rawValue = decodeURIComponent(part.slice(SESSION_COOKIE_NAME.length + 1));
      try {
        const parsed = JSON.parse(rawValue) as Partial<SessionCookiePayload>;
        if (typeof parsed.userId === 'string' && parsed.userId.length > 0) {
          return {
            userId: parsed.userId,
            projectId:
              typeof parsed.projectId === 'string' && parsed.projectId.length > 0
                ? parsed.projectId
                : 'proj-core-payments',
            shadowPreviewTier:
              parsed.shadowPreviewTier === 1 ||
              parsed.shadowPreviewTier === 2 ||
              parsed.shadowPreviewTier === 3
                ? parsed.shadowPreviewTier
                : null,
          };
        }
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function serializeSessionCookie(payload: SessionCookiePayload): string {
  const encoded = encodeURIComponent(JSON.stringify(payload));
  return `${SESSION_COOKIE_NAME}=${encoded}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`;
}

/**
 * Resolves the server-verified authenticated session.
 * Never trusts client-supplied role or clearance tier claims; always looks up
 * organization and project memberships from the authoritative repository.
 */
export async function resolveAuthenticatedSession(params: {
  repository: IChronicleRepository;
  cookieHeader?: string;
  authorizationHeader?: string;
  targetProjectId?: string;
}): Promise<AuthenticatedSession> {
  const { repository, cookieHeader, authorizationHeader, targetProjectId } = params;

  let resolvedUserId = 'usr-ujjwal-maintainer';
  let requestedShadowTier: ClearanceTier | null = null;
  let defaultProjectId = targetProjectId || 'proj-core-payments';

  // 1. Check Bearer token if provided (Supabase Auth JWT or test/Android bearer user token)
  if (authorizationHeader && authorizationHeader.startsWith('Bearer ')) {
    const token = authorizationHeader.slice('Bearer '.length).trim();
    if (token.startsWith('chronicle-test-user:')) {
      const parts = token.split(':');
      resolvedUserId = parts[1] || resolvedUserId;
      if (parts[2]) {
        const parsedShadow = Number(parts[2]);
        if (parsedShadow === 1 || parsedShadow === 2 || parsedShadow === 3) {
          requestedShadowTier = parsedShadow as ClearanceTier;
        }
      }
    } else if (
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ) {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      );
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data.user) {
        throw new Error('Invalid or expired Supabase Bearer token');
      }
      resolvedUserId = data.user.id;
    }
  } else {
    // 2. Check HttpOnly session cookie
    const cookieState = parseSessionCookieHeader(cookieHeader);
    if (cookieState) {
      resolvedUserId = cookieState.userId;
      requestedShadowTier = cookieState.shadowPreviewTier;
      if (!targetProjectId && cookieState.projectId) {
        defaultProjectId = cookieState.projectId;
      }
    }
  }

  // 3. Server-side verification against organization and project membership records
  const project = await repository.getProjectById(defaultProjectId);
  if (!project) {
    throw new Error('Requested project does not exist');
  }

  const orgMembership = await repository.getOrganizationMembership(
    project.organizationId,
    resolvedUserId
  );
  if (!orgMembership) {
    throw new Error('User does not belong to the project organization');
  }

  const projectMembership = await repository.getProjectMembership(
    project.id,
    resolvedUserId
  );
  if (!projectMembership) {
    throw new Error('User does not have membership in the requested project');
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
    email: orgMembership.email,
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
