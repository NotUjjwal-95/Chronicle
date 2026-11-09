import { getRepository } from '../../../../../../infrastructure/database';
import { ReconstructionService } from '../../../../../../services/reconstruction-service';
import {
  getRequestSession,
  handleRouteError,
  jsonSuccess,
  resolveParams,
  RouteContext,
} from '../../../../../../lib/route-helper';

export async function POST(
  req: Request,
  ctx: RouteContext
): Promise<Response> {
  try {
    const { projectId } = await resolveParams(ctx);
    const session = await getRequestSession(req, projectId);
    const service = new ReconstructionService(getRepository());
    const result = await service.verifyAllProjectCitations(session, projectId);

    return jsonSuccess(result, {
      projectId,
      effectiveTier: session.effectiveClearanceTier,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
