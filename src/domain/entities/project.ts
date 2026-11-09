import { ClearanceTier, ReconstructionMode } from '../../types/enums';

export interface Contributor {
  id: string;
  organizationId: string;
  projectId: string;
  handle: string;
  displayName: string;
  email: string;
  roleTitle: string;
  departureStatus: 'DEPARTING' | 'ACTIVE' | 'INCOMING' | 'EXTERNAL';
  primaryDomains: string[];
  accessTier: ClearanceTier;
}

export interface Project {
  id: string;
  organizationId: string;
  slug: string;
  name: string;
  description: string;
  repositoryUrl: string;
  departingLeadHandle: string;
  incomingLeadHandle: string;
  lastReconstructionMode: ReconstructionMode | null;
  lastReconstructedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMetrics {
  totalSources: number;
  redactedSecretsCount: number;
  totalClaims: number;
  verifiedClaims: number;
  humanApprovedClaims: number;
  missingEvidenceClaims: number;
  conflictedClaims: number;
  supersededClaims: number;
  openConflicts: number;
  resolvedConflicts: number;
  pendingInterviews: number;
  completedInterviews: number;
  snapshotsCount: number;
  readinessPercentage: number;
}
