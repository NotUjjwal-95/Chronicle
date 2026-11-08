import { getRepository } from '../../../../../../infrastructure/database';
import { HandoverService } from '../../../../../../services/handover-service';
import { CreateSnapshotRequestSchema } from '../../../../../../schemas/api-v1-schemas';
import {
  getRequestSession,
  handleRouteError,
  jsonSuccess,
  RouteContext,
} from '../../../../../../lib/route-helper';

export async function GET(
  req: Request,
  ctx: RouteContext
): Promise<Response> {
  try {
    const { projectId } = ctx.params;
    const session = await getRequestSession(req, projectId);
    const service = new HandoverService(getRepository());
    const snapshots = await service.listSnapshots(session, projectId);

    return jsonSuccess(
      {
        snapshots,
        totalCount: snapshots.length,
      },
      {
        projectId,
        effectiveTier: session.effectiveClearanceTier,
      }
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(
  req: Request,
  ctx: RouteContext
): Promise<Response> {
  try {
    const { projectId } = ctx.params;
    const session = await getRequestSession(req, projectId);
    const body = await req.json();
    const parsed = CreateSnapshotRequestSchema.parse(body);
    const service = new HandoverService(getRepository());
    const snapshot = await service.createHandoverSnapshot(
      session,
      projectId,
      parsed.versionTag
    );

    return jsonSuccess(
      { snapshot },
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
