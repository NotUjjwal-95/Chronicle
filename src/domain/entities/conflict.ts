import {
  ClearanceTier,
  ConflictResolutionOption,
  ConflictStatus,
} from '../../types';

export interface Conflict {
  id: string;
  organizationId: string;
  projectId: string;
  topicKey: string;
  title: string;
  description: string;
  claimAId: string;
  claimBId: string;
  claimAPreviousStatus: string;
  claimBPreviousStatus: string;
  status: ConflictStatus;
  accessTier: ClearanceTier;
  resolutionOption?: ConflictResolutionOption | null;
  winningClaimId?: string | null;
  losingClaimId?: string | null;
  synthesizedClaimId?: string | null;
  followUpNextActionClaimId?: string | null;
  resolutionRationale?: string | null;
  resolvedByUserId?: string | null;
  resolvedByDisplayName?: string | null;
  detectedAt: string;
  resolvedAt?: string | null;
}
