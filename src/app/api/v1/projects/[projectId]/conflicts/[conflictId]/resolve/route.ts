import { getRepository } from '../../../../../../../../infrastructure/database';
import { ReviewService } from '../../../../../../../../services/review-service';
import { ResolveConflictRequestSchema } from '../../../../../../../../schemas/api-v1-schemas';
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
    const { projectId, conflictId } = ctx.params;
    const session = await getRequestSession(req, projectId);
    const body = await req.json();
    const parsed = ResolveConflictRequestSchema.parse(body);
    const service = new ReviewService(getRepository());
    const result = await service.resolveConflict(
      session,
      projectId,
      conflictId,
      parsed
    );

    return jsonSuccess(result, {
      projectId,
      effectiveTier: session.effectiveClearanceTier,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
