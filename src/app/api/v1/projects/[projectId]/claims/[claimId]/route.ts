import { getRepository } from '../../../../../../../infrastructure/database';
import { ReviewService } from '../../../../../../../services/review-service';
import { UpdateClaimRequestSchema } from '../../../../../../../schemas/api-v1-schemas';
import {
  getRequestSession,
  handleRouteError,
  jsonSuccess,
  RouteContext,
} from '../../../../../../../lib/route-helper';

export async function PATCH(
  req: Request,
  ctx: RouteContext
): Promise<Response> {
  try {
    const { projectId, claimId } = ctx.params;
    const session = await getRequestSession(req, projectId);
    const body = await req.json();
    const parsed = UpdateClaimRequestSchema.parse(body);
    const service = new ReviewService(getRepository());
    const claim = await service.updateClaimReviewStatus(
      session,
      projectId,
      claimId,
      parsed
    );

    return jsonSuccess(
      { claim },
      {
        projectId,
        effectiveTier: session.effectiveClearanceTier,
      }
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
