import { getRepository } from '../../../../../../../infrastructure/database';
import { IngestionService } from '../../../../../../../services/ingestion-service';
import { GithubPrImportRequestSchema } from '../../../../../../../schemas/api-v1-schemas';
import {
  getRequestSession,
  handleRouteError,
  jsonSuccess,
  resolveParams,
  RouteContext,
} from '../../../../../../../lib/route-helper';

export async function POST(
  req: Request,
  ctx: RouteContext
): Promise<Response> {
  try {
    const { projectId } = await resolveParams(ctx);
    const session = await getRequestSession(req, projectId);
    const body = await req.json();
    const parsed = GithubPrImportRequestSchema.parse(body);
    const service = new IngestionService(getRepository());
    const result = await service.importGithubPrArtifact(
      session,
      projectId,
      parsed
    );

    return jsonSuccess(result, {
      projectId,
      effectiveTier: session.effectiveClearanceTier,
    }, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
