import { getRepository } from '../../../../../infrastructure/database';
import { ProjectService } from '../../../../../services/project-service';
import { UpdateProjectRequestSchema } from '../../../../../schemas/api-v1-schemas';
import {
  getRequestSession,
  handleRouteError,
  jsonSuccess,
  RouteContext,
} from '../../../../../lib/route-helper';

export async function GET(
  req: Request,
  ctx: RouteContext
): Promise<Response> {
  try {
    const { projectId } = ctx.params;
    const session = await getRequestSession(req, projectId);
    const service = new ProjectService(getRepository());
    const summary = await service.getProjectWorkspaceSummary(session, projectId);

    return jsonSuccess(summary, {
      projectId,
      effectiveTier: session.effectiveClearanceTier,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(
  req: Request,
  ctx: RouteContext
): Promise<Response> {
  try {
    const { projectId } = ctx.params;
    const session = await getRequestSession(req, projectId);
    const body = await req.json();
    const parsed = UpdateProjectRequestSchema.parse(body);
    const service = new ProjectService(getRepository());
    const project = await service.updateProject(session, projectId, parsed);

    return jsonSuccess(
      { project },
      {
        projectId,
        effectiveTier: session.effectiveClearanceTier,
      }
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
