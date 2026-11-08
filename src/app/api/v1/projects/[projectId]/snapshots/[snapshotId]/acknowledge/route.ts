import { getRepository } from '../../../../../../../../infrastructure/database';
import { HandoverService } from '../../../../../../../../services/handover-service';
import { AcknowledgeSnapshotRequestSchema } from '../../../../../../../../schemas/api-v1-schemas';
import {
  getRequestSession,
  handleRouteError,
  jsonSuccess,
  RouteContext,
} from '../../../../../../../../lib/route-helper';

export async function POST(
  req: Request,
  ctx: RouteContext
): Promise<Response> {
  try {
    const { projectId, snapshotId } = ctx.params;
    const session = await getRequestSession(req, projectId);
    const body = await req.json();
    const parsed = AcknowledgeSnapshotRequestSchema.parse(body);
    const service = new HandoverService(getRepository());
    const acknowledgement = await service.acknowledgeSnapshot(
      session,
      projectId,
      snapshotId,
      parsed
    );

    return jsonSuccess(
      { acknowledgement },
      {
        projectId,
        effectiveTier: session.effectiveClearanceTier,
      },
      201
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
