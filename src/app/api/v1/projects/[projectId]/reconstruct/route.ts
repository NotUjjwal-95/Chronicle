import { getRepository } from '../../../../../../infrastructure/database';
import { ReconstructionService } from '../../../../../../services/reconstruction-service';
import { ReconstructRequestSchema } from '../../../../../../schemas/api-v1-schemas';
import {
  getRequestSession,
  handleRouteError,
  jsonSuccess,
  RouteContext,
} from '../../../../../../lib/route-helper';

export async function POST(
  req: Request,
  ctx: RouteContext
): Promise<Response> {
  try {
    const { projectId } = ctx.params;
    const session = await getRequestSession(req, projectId);
    const body = await req.json().catch(() => ({}));
    const parsed = ReconstructRequestSchema.parse(body);
    const service = new ReconstructionService(getRepository());
    const result = await service.runReconstruction(session, projectId, parsed);

    return jsonSuccess(result, {
      projectId,
      effectiveTier: session.effectiveClearanceTier,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
