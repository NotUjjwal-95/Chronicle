import { getRepository } from '../../../../../../../../infrastructure/database';
import { ReviewService } from '../../../../../../../../services/review-service';
import { SubmitInterviewRequestSchema } from '../../../../../../../../schemas/api-v1-schemas';
import {
  getRequestSession,
  handleRouteError,
  jsonSuccess,
  resolveParams,
  RouteContext,
} from '../../../../../../../../lib/route-helper';

export async function POST(
  req: Request,
  ctx: RouteContext
): Promise<Response> {
  try {
    const { projectId, interviewId } = await resolveParams(ctx);
    const session = await getRequestSession(req, projectId);
    const body = await req.json();
    const parsed = SubmitInterviewRequestSchema.parse(body);
    const service = new ReviewService(getRepository());
    const result = await service.submitInterviewResponse(
      session,
      projectId,
      interviewId,
      parsed.answerTranscript
    );

    return jsonSuccess(result, {
      projectId,
      effectiveTier: session.effectiveClearanceTier,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
