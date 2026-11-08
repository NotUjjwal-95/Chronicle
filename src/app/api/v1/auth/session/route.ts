import { getRepository } from '../../../../../infrastructure/database';
import {
  DEMO_USERS,
  resolveAuthenticatedSession,
  serializeSessionCookie,
} from '../../../../../security/session-auth';
import { SessionSwitchRequestSchema } from '../../../../../schemas/api-v1-schemas';
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
        availablePersonas: DEMO_USERS,
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
    const body = await req.json();
    const parsed = SessionSwitchRequestSchema.parse(body);
    const repository = getRepository();
    const targetProjectId = parsed.projectId || 'proj-core-payments';

    const cookiePayload = {
      userId: parsed.userId,
      projectId: targetProjectId,
      shadowPreviewTier: parsed.shadowPreviewTier ?? null,
    };

    const cookieString = serializeSessionCookie(cookiePayload);

    const session = await resolveAuthenticatedSession({
      repository,
      cookieHeader: cookieString,
      targetProjectId,
    });

    await repository.appendAuditLog({
      id: `audit-session-${Date.now()}`,
      organizationId: session.organizationId,
      projectId: session.projectId,
      actorUserId: session.userId,
      actorDisplayName: session.displayName,
      actorRole: session.role,
      effectiveClearanceTier: session.effectiveClearanceTier,
      action: session.isShadowPreview
        ? 'SHADOW_PREVIEW_TOGGLED'
        : 'SESSION_SWITCHED',
      targetEntityType: 'SESSION',
      targetEntityId: session.userId,
      accessTier: session.effectiveClearanceTier,
      metadata: {
        role: session.role,
        actualClearanceTier: session.actualClearanceTier,
        effectiveClearanceTier: session.effectiveClearanceTier,
        isShadowPreview: session.isShadowPreview,
      },
      createdAt: new Date().toISOString(),
    });

    return jsonSuccess(
      {
        session,
        availablePersonas: DEMO_USERS,
      },
      {
        projectId: session.projectId,
        effectiveTier: session.effectiveClearanceTier,
      },
      200,
      {
        'Set-Cookie': cookieString,
      }
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
