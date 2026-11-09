import { getRepository } from '../../../../../../../../infrastructure/database';
import { HandoverService } from '../../../../../../../../services/handover-service';
import {
  getRequestSession,
  handleRouteError,
  jsonSuccess,
  resolveParams,
  RouteContext,
} from '../../../../../../../../lib/route-helper';

export async function GET(
  req: Request,
  ctx: RouteContext
): Promise<Response> {
  try {
    const { projectId, snapshotId } = await resolveParams(ctx);
    const session = await getRequestSession(req, projectId);
    const url = new URL(req.url);
    const formatParam = url.searchParams.get('format');
    const format = formatParam === 'json' ? 'json' : 'markdown';

    const service = new HandoverService(getRepository());
    const exported = await service.exportSnapshot(
      session,
      projectId,
      snapshotId,
      format
    );

    return jsonSuccess(exported, {
      projectId,
      effectiveTier: session.effectiveClearanceTier,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
