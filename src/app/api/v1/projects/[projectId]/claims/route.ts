import { getRepository } from '../../../../../../infrastructure/database';
import { ReviewService } from '../../../../../../services/review-service';
import {
  getRequestSession,
  handleRouteError,
  jsonSuccess,
  resolveParams,
  RouteContext,
} from '../../../../../../lib/route-helper';

export async function GET(
  req: Request,
  ctx: RouteContext
): Promise<Response> {
  try {
    const { projectId } = await resolveParams(ctx);
    const session = await getRequestSession(req, projectId);
    const service = new ReviewService(getRepository());
    const claims = await service.listClaims(session, projectId);

    return jsonSuccess(
      {
        claims,
        totalCount: claims.length,
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
