import {
  AuditLog,
  AuthenticatedSession,
  ClaimVerificationStatus,
  ClearanceTier,
  ConflictStatus,
  Contributor,
  DependencyGraphPayload,
  InterviewStatus,
  Project,
  ProjectMembership,
  ProjectMetrics,
  ProjectRole,
} from '../types';
import { IChronicleRepository } from '../infrastructure/database/repository-interface';
import {
  filterAuditLogsByClearance,
  filterClaimsByClearance,
  filterConflictsByClearance,
  filterContributorsByClearance,
  filterInterviewsByClearance,
  filterSourcesForClearance,
} from '../security/clearance-policy';
import { buildDependencyGraph } from '../domain/engines/dependency-graph-builder';
import { AuthorizationService } from './authorization-service';

export class ProjectService {
  private readonly authService: AuthorizationService;

  constructor(private readonly repository: IChronicleRepository) {
    this.authService = new AuthorizationService(repository);
  }

  public async listAuthorizedProjects(
    session: AuthenticatedSession
  ): Promise<Project[]> {
    return this.repository.listProjectsForUser(session.userId);
  }

  public async getProjectWorkspaceSummary(
    session: AuthenticatedSession,
    projectId: string
  ): Promise<{
    project: Project;
    metrics: ProjectMetrics;
  }> {
    await this.authService.authorizeProjectOperation({
      session,
      projectId,
      requiredPermission: 'project:read',
    });

    const project = await this.repository.getProjectById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const tier = session.effectiveClearanceTier;
    const allSources = await this.repository.listSources(projectId);
    const visibleSources = filterSourcesForClearance(allSources, tier);

    const allClaims = await this.repository.listClaims(projectId);
    const visibleClaims = filterClaimsByClearance(allClaims, tier);
    const visibleClaimIds = new Set(visibleClaims.map((c) => c.id));

    const allConflicts = await this.repository.listConflicts(projectId);
    const visibleConflicts = filterConflictsByClearance(
      allConflicts,
      visibleClaimIds,
      tier
    );

    const allInterviews = await this.repository.listInterviews(projectId);
    const visibleInterviews = filterInterviewsByClearance(allInterviews, tier);

    const allSnapshots = await this.repository.listSnapshots(projectId);
    const visibleSnapshots = allSnapshots.filter((s) => s.accessTier <= tier);

    const activeClaims = visibleClaims.filter(
      (c) =>
        c.verificationStatus !== ClaimVerificationStatus.SUPERSEDED &&
        c.verificationStatus !== ClaimVerificationStatus.REJECTED
    );

    const verifiedOrApprovedCount = activeClaims.filter(
      (c) =>
        c.verificationStatus === ClaimVerificationStatus.VERIFIED ||
        c.verificationStatus === ClaimVerificationStatus.HUMAN_APPROVED
    ).length;

    const openConflicts = visibleConflicts.filter(
      (c) => c.status === ConflictStatus.OPEN
    ).length;
    const resolvedConflicts = visibleConflicts.filter(
      (c) => c.status === ConflictStatus.RESOLVED
    ).length;

    const pendingInterviews = visibleInterviews.filter(
      (i) => i.status === InterviewStatus.PENDING
    ).length;
    const completedInterviews = visibleInterviews.filter(
      (i) => i.status === InterviewStatus.COMPLETED
    ).length;

    // Dynamic readiness score computed strictly from repository state
    const claimScore =
      activeClaims.length > 0
        ? (verifiedOrApprovedCount / activeClaims.length) * 50
        : 0;
    const conflictScore =
      visibleConflicts.length > 0
        ? (resolvedConflicts / visibleConflicts.length) * 30
        : 30;
    const interviewScore =
      visibleInterviews.length > 0
        ? (completedInterviews / visibleInterviews.length) * 20
        : 20;

    const readinessPercentage = Math.round(
      claimScore + conflictScore + interviewScore
    );

    const metrics: ProjectMetrics = {
      totalSources: visibleSources.length,
      redactedSecretsCount: visibleSources.reduce(
        (acc, s) => acc + s.redactedCount,
        0
      ),
      totalClaims: visibleClaims.length,
      verifiedClaims: visibleClaims.filter(
        (c) => c.verificationStatus === ClaimVerificationStatus.VERIFIED
      ).length,
      humanApprovedClaims: visibleClaims.filter(
        (c) => c.verificationStatus === ClaimVerificationStatus.HUMAN_APPROVED
      ).length,
      missingEvidenceClaims: visibleClaims.filter(
        (c) => c.verificationStatus === ClaimVerificationStatus.MISSING_EVIDENCE
      ).length,
      conflictedClaims: visibleClaims.filter(
        (c) => c.verificationStatus === ClaimVerificationStatus.CONFLICTED
      ).length,
      supersededClaims: visibleClaims.filter(
        (c) => c.verificationStatus === ClaimVerificationStatus.SUPERSEDED
      ).length,
      openConflicts,
      resolvedConflicts,
      pendingInterviews,
      completedInterviews,
      snapshotsCount: visibleSnapshots.length,
      readinessPercentage,
    };

    return { project, metrics };
  }

  public async createProject(
    session: AuthenticatedSession,
    input: {
      slug: string;
      name: string;
      description: string;
      repositoryUrl: string;
      departingLeadHandle: string;
      incomingLeadHandle: string;
    }
  ): Promise<Project> {
    if (session.isShadowPreview) {
      throw new Error('Cannot create a project while in shadow role preview');
    }

    const now = new Date().toISOString();
    const projectId = `proj-${input.slug.toLowerCase().replace(/[^a-z0-9-]+/g, '-')}-${Date.now().toString().slice(-4)}`;

    const project: Project = {
      id: projectId,
      organizationId: session.organizationId,
      slug: input.slug,
      name: input.name,
      description: input.description,
      repositoryUrl: input.repositoryUrl,
      departingLeadHandle: input.departingLeadHandle,
      incomingLeadHandle: input.incomingLeadHandle,
      lastReconstructionMode: null,
      lastReconstructedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    const membership: ProjectMembership = {
      id: `projmem-${projectId}-${session.userId}`,
      organizationId: session.organizationId,
      projectId,
      userId: session.userId,
      role: ProjectRole.MAINTAINER,
      clearanceTier: session.actualClearanceTier,
      createdAt: now,
    };

    return this.repository.createProject(project, membership);
  }

  public async updateProject(
    session: AuthenticatedSession,
    projectId: string,
    patch: Partial<
      Pick<
        Project,
        | 'name'
        | 'description'
        | 'departingLeadHandle'
        | 'incomingLeadHandle'
      >
    >
  ): Promise<Project> {
    await this.authService.authorizeProjectOperation({
      session,
      projectId,
      requiredPermission: 'project:update',
    });

    const existing = await this.repository.getProjectById(projectId);
    if (!existing) {
      throw new Error('Project not found');
    }

    const updated: Project = {
      ...existing,
      name: patch.name ?? existing.name,
      description: patch.description ?? existing.description,
      departingLeadHandle:
        patch.departingLeadHandle ?? existing.departingLeadHandle,
      incomingLeadHandle:
        patch.incomingLeadHandle ?? existing.incomingLeadHandle,
      updatedAt: new Date().toISOString(),
    };

    return this.repository.updateProject(updated);
  }

  public async listContributors(
    session: AuthenticatedSession,
    projectId: string
  ): Promise<Contributor[]> {
    await this.authService.authorizeProjectOperation({
      session,
      projectId,
      requiredPermission: 'contributor:read',
    });

    const contributors = await this.repository.listContributors(projectId);
    return filterContributorsByClearance(
      contributors,
      session.effectiveClearanceTier
    );
  }

  public async getDependencyGraph(
    session: AuthenticatedSession,
    projectId: string
  ): Promise<DependencyGraphPayload> {
    await this.authService.authorizeProjectOperation({
      session,
      projectId,
      requiredPermission: 'graph:read',
    });

    const [contributors, sources, claims, interviews, explicitEdges] =
      await Promise.all([
        this.repository.listContributors(projectId),
        this.repository.listSources(projectId),
        this.repository.listClaims(projectId),
        this.repository.listInterviews(projectId),
        this.repository.listDependencyEdges(projectId),
      ]);

    return buildDependencyGraph({
      projectId,
      organizationId: session.organizationId,
      contributors,
      sources,
      claims,
      interviews,
      explicitEdges,
      effectiveClearanceTier: session.effectiveClearanceTier,
    });
  }

  public async listAuditLogs(
    session: AuthenticatedSession,
    projectId: string
  ): Promise<AuditLog[]> {
    await this.authService.authorizeProjectOperation({
      session,
      projectId,
      requiredPermission: 'audit:read',
    });

    const logs = await this.repository.listAuditLogs(projectId);
    return filterAuditLogsByClearance(logs, session.effectiveClearanceTier);
  }

  public async resetDemoWorkspace(
    session: AuthenticatedSession,
    projectId: string
  ): Promise<void> {
    await this.authService.authorizeProjectOperation({
      session,
      projectId,
      requiredPermission: 'workspace:reset',
      requiredClearanceTier: ClearanceTier.TIER_3_CONFIDENTIAL,
    });

    await this.repository.resetProjectToSeed(projectId);
    await this.repository.appendAuditLog({
      id: `audit-reset-${Date.now()}`,
      organizationId: session.organizationId,
      projectId,
      actorUserId: session.userId,
      actorDisplayName: session.displayName,
      actorRole: session.role,
      effectiveClearanceTier: session.effectiveClearanceTier,
      action: 'DEMO_WORKSPACE_RESET',
      targetEntityType: 'PROJECT',
      targetEntityId: projectId,
      accessTier: ClearanceTier.TIER_1_EXTERNAL,
      metadata: { reason: 'Explicit user reset to deterministic seed baseline' },
      createdAt: new Date().toISOString(),
    });
  }
}
