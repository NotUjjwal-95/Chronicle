import {
  Claim,
  ClaimCitation,
  ClaimVerificationStatus,
  SourceArtifact,
  transitionClaimStatus,
} from '../../types';

export interface GroundingVerificationInput {
  sourceId: string;
  verbatimQuote: string;
  charStart: number;
  charEnd: number;
}

export interface GroundingVerificationResult {
  sourceId: string;
  verbatimQuote: string;
  charStart: number;
  charEnd: number;
  verificationStatus: 'VERIFIED' | 'MISSING_EVIDENCE';
  reason: string;
}

/**
 * Verifies a citation against the exact sanitized content of its referenced SourceArtifact.
 * Offsets must refer to the sanitized content coordinate system.
 */
export function verifyCitationAgainstSource(
  citation: GroundingVerificationInput,
  source: SourceArtifact | undefined
): GroundingVerificationResult {
  if (!source) {
    return {
      ...citation,
      verificationStatus: 'MISSING_EVIDENCE',
      reason: 'Referenced source artifact does not exist or is inaccessible.',
    };
  }

  const content = source.sanitizedContent;
  const quote = citation.verbatimQuote;

  if (!quote || quote.trim().length === 0) {
    return {
      ...citation,
      verificationStatus: 'MISSING_EVIDENCE',
      reason: 'Citation verbatim quote is empty.',
    };
  }

  // 1. Check exact character slice match
  if (
    citation.charStart >= 0 &&
    citation.charEnd > citation.charStart &&
    citation.charEnd <= content.length
  ) {
    const sliced = content.slice(citation.charStart, citation.charEnd);
    if (sliced === quote) {
      return {
        sourceId: citation.sourceId,
        verbatimQuote: quote,
        charStart: citation.charStart,
        charEnd: citation.charEnd,
        verificationStatus: 'VERIFIED',
        reason: 'Exact character offset and verbatim quote verified against sanitized source.',
      };
    }
  }

  // 2. Check if the verbatim quote exists in the sanitized content and align exact offsets
  const foundIndex = content.indexOf(quote);
  if (foundIndex !== -1) {
    return {
      sourceId: citation.sourceId,
      verbatimQuote: quote,
      charStart: foundIndex,
      charEnd: foundIndex + quote.length,
      verificationStatus: 'VERIFIED',
      reason: 'Verbatim quote grounded and character offsets aligned to sanitized source.',
    };
  }

  return {
    ...citation,
    verificationStatus: 'MISSING_EVIDENCE',
    reason: 'Verbatim quote does not match sanitized source content at any offset.',
  };
}

/**
 * Grounds all citations on a claim and transitions the claim state appropriately,
 * while strictly respecting Section 5.2 (human approval is never overwritten by automated verification).
 */
export function verifyClaimCitations(
  claim: Claim,
  sourcesById: ReadonlyMap<string, SourceArtifact>,
  actorId = 'system-citation-grounder'
): Claim {
  if (claim.citations.length === 0) {
    if (
      claim.verificationStatus === ClaimVerificationStatus.EXTRACTED
    ) {
      return transitionClaimStatus(
        claim,
        ClaimVerificationStatus.MISSING_EVIDENCE,
        actorId,
        'AUTOMATED',
        'Claim has no citations attached.'
      );
    }
    return claim;
  }

  const updatedCitations: ClaimCitation[] = claim.citations.map((cit) => {
    const source = sourcesById.get(cit.sourceId);
    const result = verifyCitationAgainstSource(
      {
        sourceId: cit.sourceId,
        verbatimQuote: cit.verbatimQuote,
        charStart: cit.charStart,
        charEnd: cit.charEnd,
      },
      source
    );

    return {
      ...cit,
      charStart: result.charStart,
      charEnd: result.charEnd,
      verificationStatus: result.verificationStatus,
    };
  });

  const allVerified = updatedCitations.every(
    (c) => c.verificationStatus === 'VERIFIED'
  );

  const claimWithUpdatedCitations: Claim = {
    ...claim,
    citations: updatedCitations,
  };

  // Preserve terminal or human-controlled states (HUMAN_APPROVED, CONFLICTED, SUPERSEDED, REJECTED)
  if (
    claim.verificationStatus === ClaimVerificationStatus.HUMAN_APPROVED ||
    claim.verificationStatus === ClaimVerificationStatus.CONFLICTED ||
    claim.verificationStatus === ClaimVerificationStatus.SUPERSEDED ||
    claim.verificationStatus === ClaimVerificationStatus.REJECTED
  ) {
    return claimWithUpdatedCitations;
  }

  const targetStatus = allVerified
    ? ClaimVerificationStatus.VERIFIED
    : ClaimVerificationStatus.MISSING_EVIDENCE;

  return transitionClaimStatus(
    claimWithUpdatedCitations,
    targetStatus,
    actorId,
    'AUTOMATED',
    allVerified
      ? 'All claim citations programmatically verified against sanitized source offsets.'
      : 'One or more citations failed programmatic grounding against sanitized source content.'
  );
}
