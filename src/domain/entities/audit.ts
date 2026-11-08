import { ClearanceTier, ProjectRole } from '../../types';

export interface AuditLog {
  id: string;
  sequenceNumber: number;
  organizationId: string;
  projectId: string;
  actorUserId: string;
  actorDisplayName: string;
  actorRole: ProjectRole;
  effectiveClearanceTier: ClearanceTier;
  action:
    | 'SESSION_SWITCHED'
    | 'SHADOW_PREVIEW_TOGGLED'
    | 'SOURCE_INGESTED'
    | 'GITHUB_PR_IMPORTED'
    | 'RECONSTRUCTION_EXECUTED'
    | 'CITATIONS_VERIFIED'
    | 'CLAIM_STATUS_UPDATED'
    | 'CONFLICT_RESOLVED'
    | 'INTERVIEW_SUBMITTED'
    | 'SNAPSHOT_CREATED'
    | 'SNAPSHOT_VERIFIED'
    | 'SNAPSHOT_ACKNOWLEDGED'
    | 'SNAPSHOT_EXPORTED'
    | 'DEMO_WORKSPACE_RESET';
  targetEntityType: string;
  targetEntityId: string;
  accessTier: ClearanceTier;
  metadata: Record<string, unknown>;
  createdAt: string;
}
