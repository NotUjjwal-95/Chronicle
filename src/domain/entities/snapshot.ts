import { ClearanceTier, ReconstructionMode } from '../../types/enums';
import { Claim } from './claim';
import { Conflict } from './conflict';
import { ExitInterview } from './interview';
import { Contributor } from './project';

export interface FirstSevenDaysAction {
  dayRange: 'DAY_1_2' | 'DAY_3_5' | 'DAY_6_7';
  title: string;
  rationale: string;
  priority: 'CRITICAL' | 'HIGH' | 'STANDARD';
  relatedClaimId?: string;
  modulePath?: string;
  ownerHandle?: string;
}

export interface CanonicalSnapshotPayload {
  schemaVersion: 'chronicle.handover.v1';
  projectId: string;
  organizationId: string;
  projectName: string;
  repositoryUrl: string;
  versionTag: string;
  effectiveClearanceTier: ClearanceTier;
  reconstructionMode: ReconstructionMode;
  activeDecisions: Claim[];
  unfinishedWork: Claim[];
  risksAndBlockers: Claim[];
  dependencies: Claim[];
  ownershipContacts: Claim[];
  nextActions: Claim[];
  contributors: Contributor[];
  resolvedConflicts: Conflict[];
  supersededClaimsHistory: Claim[];
  openKnowledgeGaps: ExitInterview[];
  completedInterviews: ExitInterview[];
  firstSevenDaysPlan: FirstSevenDaysAction[];
}

export interface SnapshotAcknowledgement {
  id: string;
  organizationId: string;
  projectId: string;
  snapshotId: string;
  acknowledgedByUserId: string;
  acknowledgedByName: string;
  acknowledgedByRole: string;
  notes: string;
  verifiedDigest: string;
  acknowledgedAt: string;
}

export interface HandoverSnapshot {
  id: string;
  organizationId: string;
  projectId: string;
  versionTag: string;
  accessTier: ClearanceTier;
  canonicalPayload: CanonicalSnapshotPayload;
  sha256Digest: string;
  createdByUserId: string;
  createdByName: string;
  createdAt: string;
  acknowledgements: SnapshotAcknowledgement[];
}
