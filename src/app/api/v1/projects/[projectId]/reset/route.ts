import { getRepository } from '../../../../../../infrastructure/database';
import { ProjectService } from '../../../../../../services/project-service';
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
    const service = new ProjectService(getRepository());
    await service.resetDemoWorkspace(session, projectId);

    const summary = await service.getProjectWorkspaceSummary(session, projectId);
    return jsonSuccess(
      {
        reset: true,
        ...summary,
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
