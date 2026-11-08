import { getRepository } from '../../../../../../infrastructure/database';
import { ReviewService } from '../../../../../../services/review-service';
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
    const service = new ReviewService(getRepository());
    const conflicts = await service.listConflicts(session, projectId);

    return jsonSuccess(
      {
        conflicts,
        totalCount: conflicts.length,
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
