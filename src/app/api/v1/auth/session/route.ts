import { getRepository } from '../../../../../infrastructure/database';
import {
  resolveAuthenticatedSession,
  serializeShadowPreviewCookie,
} from '../../../../../security/session-auth';
import { ShadowPreviewToggleRequestSchema } from '../../../../../schemas/api-v1-schemas';
import {
  getRequestSession,
  handleRouteError,
  jsonSuccess,
} from '../../../../../lib/route-helper';

export async function GET(req: Request): Promise<Response> {
  try {
    const session = await getRequestSession(req);
    return jsonSuccess(
      {
        session,
      },
      {
        projectId: session.projectId,
        effectiveTier: session.effectiveClearanceTier,
      }
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    // 1. Authenticate the caller: client can NEVER supply or switch identities
    const body = await req.json();
    const parsed = ShadowPreviewToggleRequestSchema.parse(body);
    const targetProjectId = parsed.projectId || 'proj-core-payments';

    const currentSession = await getRequestSession(req, targetProjectId);
    const repository = getRepository();

    // 2. Prepare shadow preview cookie for the verified caller
    const shadowCookie = serializeShadowPreviewCookie(
      parsed.shadowPreviewTier ?? null
    );

    // 3. Re-resolve session with updated shadow tier
    const updatedSession = await resolveAuthenticatedSession({
      repository,
      cookieHeader: req.headers.get('cookie') ?? undefined,
      authorizationHeader: req.headers.get('authorization') ?? undefined,
      shadowHeader: parsed.shadowPreviewTier
        ? String(parsed.shadowPreviewTier)
        : undefined,
      targetProjectId,
    });

    await repository.appendAuditLog({
      id: `audit-shadow-${Date.now()}`,
      organizationId: updatedSession.organizationId,
      projectId: updatedSession.projectId,
      actorUserId: updatedSession.userId,
      actorDisplayName: updatedSession.displayName,
      actorRole: updatedSession.role,
      effectiveClearanceTier: updatedSession.effectiveClearanceTier,
      action: 'SHADOW_PREVIEW_TOGGLED',
      targetEntityType: 'SESSION',
      targetEntityId: updatedSession.userId,
      accessTier: updatedSession.effectiveClearanceTier,
      metadata: {
        role: updatedSession.role,
        actualClearanceTier: updatedSession.actualClearanceTier,
        effectiveClearanceTier: updatedSession.effectiveClearanceTier,
        isShadowPreview: updatedSession.isShadowPreview,
      },
      createdAt: new Date().toISOString(),
    });

    return jsonSuccess(
      {
        session: updatedSession,
      },
      {
        projectId: updatedSession.projectId,
        effectiveTier: updatedSession.effectiveClearanceTier,
      },
      200,
      {
        'Set-Cookie': shadowCookie,
      }
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
