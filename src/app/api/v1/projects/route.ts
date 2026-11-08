import { getRepository } from '../../../../infrastructure/database';
import { ProjectService } from '../../../../services/project-service';
import { CreateProjectRequestSchema } from '../../../../schemas/api-v1-schemas';
import {
  getRequestSession,
  handleRouteError,
  jsonSuccess,
} from '../../../../lib/route-helper';

export async function GET(req: Request): Promise<Response> {
  try {
    const session = await getRequestSession(req);
    const service = new ProjectService(getRepository());
    const projects = await service.listAuthorizedProjects(session);

    return jsonSuccess(
      { projects },
      {
        projectId: session.projectId,
        effectiveTier: session.effectiveClearanceTier,
      }
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const session = await getRequestSession(req);
    const body = await req.json();
    const parsed = CreateProjectRequestSchema.parse(body);
    const service = new ProjectService(getRepository());
    const project = await service.createProject(session, parsed);

    return jsonSuccess(
      { project },
      {
        projectId: project.id,
        effectiveTier: session.effectiveClearanceTier,
      },
      201
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
