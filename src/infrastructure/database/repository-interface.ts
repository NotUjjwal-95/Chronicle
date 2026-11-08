import {
  AuditLog,
  Claim,
  Conflict,
  Contributor,
  DependencyEdge,
  ExitInterview,
  HandoverSnapshot,
  Organization,
  OrganizationMembership,
  PersistenceMode,
  Project,
  ProjectMembership,
  SnapshotAcknowledgement,
  SourceArtifact,
} from '../../types';

export interface AtomicConflictResolutionMutation {
  conflict: Conflict;
  updatedClaims: Claim[];
  newClaims: Claim[];
  auditLog: Omit<AuditLog, 'sequenceNumber'>;
}

export interface IChronicleRepository {
  readonly mode: PersistenceMode;

  // Organization & Multi-tenant Membership
  getOrganizationById(orgId: string): Promise<Organization | null>;
  getOrganizationMembership(
    orgId: string,
    userId: string
  ): Promise<OrganizationMembership | null>;
  listOrganizationMemberships(orgId: string): Promise<OrganizationMembership[]>;
  getProjectMembership(
    projectId: string,
    userId: string
  ): Promise<ProjectMembership | null>;
  listProjectMemberships(projectId: string): Promise<ProjectMembership[]>;

  // Projects
  listProjectsForUser(userId: string): Promise<Project[]>;
  getProjectById(projectId: string): Promise<Project | null>;
  createProject(project: Project, creatorMembership: ProjectMembership): Promise<Project>;
  updateProject(project: Project): Promise<Project>;

  // Contributors
  listContributors(projectId: string): Promise<Contributor[]>;

  // Sources
  listSources(projectId: string): Promise<SourceArtifact[]>;
  getSourceById(projectId: string, sourceId: string): Promise<SourceArtifact | null>;
  createSource(source: SourceArtifact): Promise<SourceArtifact>;

  // Claims
  listClaims(projectId: string): Promise<Claim[]>;
  getClaimById(projectId: string, claimId: string): Promise<Claim | null>;
  upsertClaims(projectId: string, claims: Claim[]): Promise<Claim[]>;
  updateClaim(projectId: string, claim: Claim): Promise<Claim>;

  // Conflicts
  listConflicts(projectId: string): Promise<Conflict[]>;
  getConflictById(projectId: string, conflictId: string): Promise<Conflict | null>;
  upsertConflicts(projectId: string, conflicts: Conflict[]): Promise<Conflict[]>;
  resolveConflictAtomically(
    projectId: string,
    mutation: AtomicConflictResolutionMutation
  ): Promise<{
    conflict: Conflict;
    updatedClaims: Claim[];
    newClaims: Claim[];
    auditLog: AuditLog;
  }>;

  // Exit Interviews
  listInterviews(projectId: string): Promise<ExitInterview[]>;
  getInterviewById(
    projectId: string,
    interviewId: string
  ): Promise<ExitInterview | null>;
  updateInterview(
    projectId: string,
    interview: ExitInterview,
    generatedClaims: Claim[]
  ): Promise<ExitInterview>;

  // Dependency Edges
  listDependencyEdges(projectId: string): Promise<DependencyEdge[]>;

  // Snapshots & Acknowledgements
  listSnapshots(projectId: string): Promise<HandoverSnapshot[]>;
  getSnapshotById(
    projectId: string,
    snapshotId: string
  ): Promise<HandoverSnapshot | null>;
  createSnapshot(snapshot: HandoverSnapshot): Promise<HandoverSnapshot>;
  createSnapshotAcknowledgement(
    ack: SnapshotAcknowledgement
  ): Promise<SnapshotAcknowledgement>;

  // Audit Logs
  listAuditLogs(projectId: string): Promise<AuditLog[]>;
  appendAuditLog(log: Omit<AuditLog, 'sequenceNumber'>): Promise<AuditLog>;

  // Reset Demo Workspace
  resetProjectToSeed(projectId: string): Promise<void>;
}
