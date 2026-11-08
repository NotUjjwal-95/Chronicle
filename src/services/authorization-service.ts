import { AuthenticatedSession, ClearanceTier } from '../types';
import { IChronicleRepository } from '../infrastructure/database/repository-interface';
import {
  hasRolePermission,
  ProjectPermission,
} from '../security/rbac-policy';
import { canAccessClearance } from '../security/clearance-policy';

export class AuthorizationError extends Error {
  public readonly code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND';
  public readonly statusCode: number;

  constructor(
    code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND',
    message: string,
    statusCode = 403
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class AuthorizationService {
  constructor(private readonly repository: IChronicleRepository) {}

  /**
   * Enforces the 5-step multi-tenant isolation & RBAC check from Section 6.2:
   * 1. Authenticated user exists.
   * 2. User belongs to the organization.
   * 3. User has membership in the requested project.
   * 4. User's role permits the requested action (and shadow preview is read-only).
   * 5. User's effective clearance permits access to the requested data.
   */
  public async authorizeProjectOperation(params: {
    session: AuthenticatedSession;
    projectId: string;
    requiredPermission: ProjectPermission;
    requiredClearanceTier?: ClearanceTier;
  }): Promise<void> {
    const {
      session,
      projectId,
      requiredPermission,
      requiredClearanceTier = ClearanceTier.TIER_1_EXTERNAL,
    } = params;

    if (!session || !session.userId) {
      throw new AuthorizationError(
        'UNAUTHORIZED',
        'Authentication required',
        401
      );
    }

    const project = await this.repository.getProjectById(projectId);
    if (!project) {
      throw new AuthorizationError('NOT_FOUND', 'Resource not found', 404);
    }

    const orgMem = await this.repository.getOrganizationMembership(
      project.organizationId,
      session.userId
    );
    if (!orgMem) {
      // Never disclose inaccessible records through error details
      throw new AuthorizationError(
        'FORBIDDEN',
        'Insufficient permissions',
        403
      );
    }

    const projMem = await this.repository.getProjectMembership(
      projectId,
      session.userId
    );
    if (!projMem) {
      throw new AuthorizationError(
        'FORBIDDEN',
        'Insufficient permissions',
        403
      );
    }

    if (
      !hasRolePermission(
        projMem.role,
        requiredPermission,
        session.isShadowPreview
      )
    ) {
      throw new AuthorizationError(
        'FORBIDDEN',
        session.isShadowPreview
          ? 'Shadow role preview is strictly read-only'
          : 'Insufficient permissions',
        403
      );
    }

    if (
      !canAccessClearance(
        session.effectiveClearanceTier,
        requiredClearanceTier
      )
    ) {
      throw new AuthorizationError(
        'FORBIDDEN',
        'Insufficient permissions',
        403
      );
    }
  }
}
