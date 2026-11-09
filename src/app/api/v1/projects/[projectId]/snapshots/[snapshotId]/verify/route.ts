import { getRepository } from '../../../../../../../../infrastructure/database';
import { HandoverService } from '../../../../../../../../services/handover-service';
import { VerifySnapshotRequestSchema } from '../../../../../../../../schemas/api-v1-schemas';
import {
  getRequestSession,
  handleRouteError,
  jsonSuccess,
  resolveParams,
  RouteContext,
} from '../../../../../../../../lib/route-helper';

export async function POST(
  req: Request,
  ctx: RouteContext
): Promise<Response> {
  try {
    const { projectId, snapshotId } = await resolveParams(ctx);
    const session = await getRequestSession(req, projectId);
    const body = await req.json().catch(() => ({}));
    const parsed = VerifySnapshotRequestSchema.parse(body);
    const service = new HandoverService(getRepository());
    const verification = await service.verifySnapshot(
      session,
      projectId,
      snapshotId,
      parsed.expectedDigest
    );

    return jsonSuccess(
      { verification },
      {
        projectId,
        effectiveTier: session.effectiveClearanceTier,
      }
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
