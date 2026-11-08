import { getRepository } from '../../../../../../infrastructure/database';
import { IngestionService } from '../../../../../../services/ingestion-service';
import { IngestSourceRequestSchema } from '../../../../../../schemas/api-v1-schemas';
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
    const service = new IngestionService(getRepository());
    const sources = await service.listAuthorizedSources(session, projectId);

    return jsonSuccess(
      {
        sources,
        totalCount: sources.length,
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

export async function POST(
  req: Request,
  ctx: RouteContext
): Promise<Response> {
  try {
    const { projectId } = ctx.params;
    const session = await getRequestSession(req, projectId);
    const body = await req.json();
    const parsed = IngestSourceRequestSchema.parse(body);
    const service = new IngestionService(getRepository());
    const source = await service.ingestSourceArtifact(
      session,
      projectId,
      parsed
    );

    return jsonSuccess(
      { source },
      {
        projectId,
        effectiveTier: session.effectiveClearanceTier,
      },
      201
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
