import { ClearanceTier } from '../../../../types';
import { getRepository } from '../../../../infrastructure/database';
import { handleRouteError, jsonSuccess } from '../../../../lib/route-helper';

export async function GET(): Promise<Response> {
  try {
    const repository = getRepository();
    return jsonSuccess(
      {
        status: 'healthy',
        service: 'chronicle-handover-intelligence',
        version: '1.0.0',
        persistenceMode: repository.mode,
      },
      {
        projectId: 'proj-core-payments',
        effectiveTier: ClearanceTier.TIER_1_EXTERNAL,
      }
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
