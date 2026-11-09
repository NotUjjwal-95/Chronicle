import {
  ClaimCategory,
  ClaimVerificationStatus,
  ClearanceTier,
  ExtractionOrigin,
} from '../../types/enums';

export interface ClaimCitation {
  id: string;
  projectId: string;
  claimId: string;
  sourceId: string;
  sourceTitle?: string;
  sourceExternalRef?: string;
  verbatimQuote: string;
  charStart: number;
  charEnd: number;
  verificationStatus: 'VERIFIED' | 'MISSING_EVIDENCE';
  accessTier: ClearanceTier;
}

export interface ClaimStateTransition {
  from: ClaimVerificationStatus;
  to: ClaimVerificationStatus;
  actorId: string;
  actorType: 'AUTOMATED' | 'HUMAN';
  reason: string;
  timestamp: string;
}

export interface Claim {
  id: string;
  organizationId: string;
  projectId: string;
  category: ClaimCategory;
  topicKey: string;
  stanceValue: string;
  title: string;
  summary: string;
  verificationStatus: ClaimVerificationStatus;
  extractionOrigin: ExtractionOrigin;
  confidenceScore: number;
  accessTier: ClearanceTier;
  ownerHandle?: string;
  modulePaths: string[];
  interviewId?: string | null;
  synthesizedFromClaimIds?: string[];
  supersededByClaimId?: string | null;
  citations: ClaimCitation[];
  stateHistory: ClaimStateTransition[];
  createdAt: string;
  updatedAt: string;
}

export const VALID_CLAIM_TRANSITIONS: Record<
  ClaimVerificationStatus,
  ClaimVerificationStatus[]
> = {
  [ClaimVerificationStatus.EXTRACTED]: [
    ClaimVerificationStatus.VERIFIED,
    ClaimVerificationStatus.MISSING_EVIDENCE,
    ClaimVerificationStatus.CONFLICTED,
    ClaimVerificationStatus.REJECTED,
  ],
  [ClaimVerificationStatus.VERIFIED]: [
    ClaimVerificationStatus.CONFLICTED,
    ClaimVerificationStatus.HUMAN_APPROVED,
    ClaimVerificationStatus.SUPERSEDED,
    ClaimVerificationStatus.REJECTED,
  ],
  [ClaimVerificationStatus.MISSING_EVIDENCE]: [
    ClaimVerificationStatus.VERIFIED,
    ClaimVerificationStatus.HUMAN_APPROVED,
    ClaimVerificationStatus.REJECTED,
  ],
  [ClaimVerificationStatus.CONFLICTED]: [
    ClaimVerificationStatus.HUMAN_APPROVED,
    ClaimVerificationStatus.SUPERSEDED,
  ],
  [ClaimVerificationStatus.HUMAN_APPROVED]: [
    ClaimVerificationStatus.SUPERSEDED,
    ClaimVerificationStatus.REJECTED,
  ],
  [ClaimVerificationStatus.SUPERSEDED]: [],
  [ClaimVerificationStatus.REJECTED]: [],
};

export function canTransitionClaimStatus(
  from: ClaimVerificationStatus,
  to: ClaimVerificationStatus,
  actorType: 'AUTOMATED' | 'HUMAN' = 'HUMAN'
): boolean {
  if (from === to) {
    return true;
  }

  // Rule: A human approval must never be silently overwritten by an automated extraction or verification process.
  if (
    from === ClaimVerificationStatus.HUMAN_APPROVED &&
    actorType === 'AUTOMATED'
  ) {
    return false;
  }

  // Rule: Transitions to HUMAN_APPROVED or REJECTED require an explicit HUMAN actor.
  if (
    (to === ClaimVerificationStatus.HUMAN_APPROVED ||
      to === ClaimVerificationStatus.REJECTED) &&
    actorType === 'AUTOMATED'
  ) {
    return false;
  }

  const allowed = VALID_CLAIM_TRANSITIONS[from] ?? [];
  return allowed.includes(to);
}

export function transitionClaimStatus(
  claim: Claim,
  targetStatus: ClaimVerificationStatus,
  actorId: string,
  actorType: 'AUTOMATED' | 'HUMAN',
  reason: string
): Claim {
  if (claim.verificationStatus === targetStatus) {
    return claim;
  }

  if (!canTransitionClaimStatus(claim.verificationStatus, targetStatus, actorType)) {
    throw new Error(
      `Invalid claim state transition from ${claim.verificationStatus} to ${targetStatus} by ${actorType} actor`
    );
  }

  const now = new Date().toISOString();
  const transitionRecord: ClaimStateTransition = {
    from: claim.verificationStatus,
    to: targetStatus,
    actorId,
    actorType,
    reason,
    timestamp: now,
  };

  return {
    ...claim,
    verificationStatus: targetStatus,
    stateHistory: [...claim.stateHistory, transitionRecord],
    updatedAt: now,
  };
}
