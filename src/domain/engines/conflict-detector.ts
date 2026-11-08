import {
  Claim,
  ClaimVerificationStatus,
  ClearanceTier,
  Conflict,
  ConflictStatus,
  transitionClaimStatus,
} from '../../types';

export interface ConflictDetectionResult {
  updatedClaims: Claim[];
  newConflicts: Conflict[];
}

/**
 * Detects multi-source contradictions using canonical topic keys, opposing stance values,
 * temporal ordering, and source provenance.
 * Never automatically resolves a contradiction based on source recency or AI confidence.
 */
export function detectConflicts(params: {
  organizationId: string;
  projectId: string;
  claims: Claim[];
  existingConflicts: Conflict[];
}): ConflictDetectionResult {
  const { organizationId, projectId, claims, existingConflicts } = params;

  const existingPairKeys = new Set<string>();
  for (const c of existingConflicts) {
    const pairKey1 = `${c.claimAId}::${c.claimBId}`;
    const pairKey2 = `${c.claimBId}::${c.claimAId}`;
    existingPairKeys.add(pairKey1);
    existingPairKeys.add(pairKey2);
  }

  const claimsByTopic = new Map<string, Claim[]>();
  for (const claim of claims) {
    if (
      claim.verificationStatus === ClaimVerificationStatus.SUPERSEDED ||
      claim.verificationStatus === ClaimVerificationStatus.REJECTED
    ) {
      continue;
    }
    const list = claimsByTopic.get(claim.topicKey) ?? [];
    list.push(claim);
    claimsByTopic.set(claim.topicKey, list);
  }

  const claimMap = new Map<string, Claim>(claims.map((c) => [c.id, c]));
  const newConflicts: Conflict[] = [];

  for (const [topicKey, topicClaims] of claimsByTopic.entries()) {
    if (topicClaims.length < 2) {
      continue;
    }

    // Sort temporally by createdAt ascending
    const sorted = [...topicClaims].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt)
    );

    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const claimA = claimMap.get(sorted[i].id)!;
        const claimB = claimMap.get(sorted[j].id)!;

        // Contradiction requires distinct stance values on the same canonical topic
        if (
          !claimA.stanceValue ||
          !claimB.stanceValue ||
          claimA.stanceValue === claimB.stanceValue
        ) {
          continue;
        }

        const pairKey = `${claimA.id}::${claimB.id}`;
        if (existingPairKeys.has(pairKey)) {
          continue;
        }

        existingPairKeys.add(pairKey);

        const prevStatusA = claimA.verificationStatus;
        const prevStatusB = claimB.verificationStatus;

        // Transition EXTRACTED or VERIFIED claims into CONFLICTED (never overwrite HUMAN_APPROVED)
        if (
          claimA.verificationStatus === ClaimVerificationStatus.EXTRACTED ||
          claimA.verificationStatus === ClaimVerificationStatus.VERIFIED
        ) {
          claimMap.set(
            claimA.id,
            transitionClaimStatus(
              claimA,
              ClaimVerificationStatus.CONFLICTED,
              'system-conflict-detector',
              'AUTOMATED',
              `Opposing stance detected on topic "${topicKey}" (${claimA.stanceValue} vs ${claimB.stanceValue}).`
            )
          );
        }

        if (
          claimB.verificationStatus === ClaimVerificationStatus.EXTRACTED ||
          claimB.verificationStatus === ClaimVerificationStatus.VERIFIED
        ) {
          claimMap.set(
            claimB.id,
            transitionClaimStatus(
              claimB,
              ClaimVerificationStatus.CONFLICTED,
              'system-conflict-detector',
              'AUTOMATED',
              `Opposing stance detected on topic "${topicKey}" (${claimB.stanceValue} vs ${claimA.stanceValue}).`
            )
          );
        }

        const requiredTier = Math.max(
          claimA.accessTier,
          claimB.accessTier
        ) as ClearanceTier;

        newConflicts.push({
          id: `conflict-${topicKey}-${claimA.id.slice(-4)}-${claimB.id.slice(-4)}`,
          organizationId,
          projectId,
          topicKey,
          title: `Contradiction on ${topicKey.replace(/-/g, ' ')}`,
          description: `Source claim "${claimA.title}" (${claimA.stanceValue}) directly contradicts "${claimB.title}" (${claimB.stanceValue}). Explicit human review is required.`,
          claimAId: claimA.id,
          claimBId: claimB.id,
          claimAPreviousStatus: prevStatusA,
          claimBPreviousStatus: prevStatusB,
          status: ConflictStatus.OPEN,
          accessTier: requiredTier,
          detectedAt: new Date().toISOString(),
        });
      }
    }
  }

  return {
    updatedClaims: Array.from(claimMap.values()),
    newConflicts,
  };
}
