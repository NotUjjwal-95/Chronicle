import { getRepository } from '../../../../../../infrastructure/database';
import { ProjectService } from '../../../../../../services/project-service';
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
    const service = new ProjectService(getRepository());
    const contributors = await service.listContributors(session, projectId);

    return jsonSuccess(
      {
        contributors,
        totalCount: contributors.length,
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
