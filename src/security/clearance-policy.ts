import {
  AuditLog,
  Claim,
  ClaimCitation,
  ClearanceTier,
  Conflict,
  Contributor,
  DependencyEdge,
  DependencyGraphNode,
  ExitInterview,
  ProjectRole,
  SanitizedSource,
  SourceArtifact,
} from '../types';

/**
 * Computes the effective clearance tier for a session, enforcing Section 6.3:
 * - Only a TIER_3 MAINTAINER may preview a lower-clearance view.
 * - Preview can never escalate above actualClearanceTier.
 */
export function resolveEffectiveClearanceTier(params: {
  role: ProjectRole;
  actualClearanceTier: ClearanceTier;
  requestedShadowTier?: ClearanceTier | null;
}): {
  effectiveClearanceTier: ClearanceTier;
  isShadowPreview: boolean;
} {
  const { role, actualClearanceTier, requestedShadowTier } = params;

  if (requestedShadowTier === undefined || requestedShadowTier === null) {
    return {
      effectiveClearanceTier: actualClearanceTier,
      isShadowPreview: false,
    };
  }

  // Only a TIER_3_CONFIDENTIAL MAINTAINER is permitted to enter shadow preview
  if (
    role !== ProjectRole.MAINTAINER ||
    actualClearanceTier !== ClearanceTier.TIER_3_CONFIDENTIAL
  ) {
    throw new Error(
      'Shadow role preview is restricted to Tier 3 Maintainers and cannot escalate privileges.'
    );
  }

  if (requestedShadowTier > actualClearanceTier) {
    throw new Error('Shadow preview cannot exceed actual user clearance.');
  }

  if (requestedShadowTier === actualClearanceTier) {
    return {
      effectiveClearanceTier: actualClearanceTier,
      isShadowPreview: false,
    };
  }

  return {
    effectiveClearanceTier: requestedShadowTier,
    isShadowPreview: true,
  };
}

export function canAccessClearance(
  effectiveUserTier: ClearanceTier,
  resourceTier: ClearanceTier
): boolean {
  return resourceTier <= effectiveUserTier;
}

export function filterByClearance<T extends { accessTier: ClearanceTier }>(
  items: T[],
  effectiveUserTier: ClearanceTier
): T[] {
  return items.filter((item) => canAccessClearance(effectiveUserTier, item.accessTier));
}

export function filterClaimsByClearance(
  claims: Claim[],
  effectiveUserTier: ClearanceTier
): Claim[] {
  return claims
    .filter((claim) => canAccessClearance(effectiveUserTier, claim.accessTier))
    .map((claim) => ({
      ...claim,
      citations: claim.citations.filter((citation: ClaimCitation) =>
        canAccessClearance(effectiveUserTier, citation.accessTier)
      ),
    }));
}

export function filterConflictsByClearance(
  conflicts: Conflict[],
  visibleClaimIds: ReadonlySet<string>,
  effectiveUserTier: ClearanceTier
): Conflict[] {
  return conflicts.filter(
    (conflict) =>
      canAccessClearance(effectiveUserTier, conflict.accessTier) &&
      visibleClaimIds.has(conflict.claimAId) &&
      visibleClaimIds.has(conflict.claimBId)
  );
}

export function filterGraphByClearance(
  nodes: DependencyGraphNode[],
  edges: DependencyEdge[],
  effectiveUserTier: ClearanceTier
): {
  nodes: DependencyGraphNode[];
  edges: DependencyEdge[];
} {
  const visibleNodes = filterByClearance(nodes, effectiveUserTier);
  const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));
  const visibleEdges = edges.filter(
    (edge) =>
      canAccessClearance(effectiveUserTier, edge.accessTier) &&
      visibleNodeIds.has(edge.sourceNodeId) &&
      visibleNodeIds.has(edge.targetNodeId)
  );
  return { nodes: visibleNodes, edges: visibleEdges };
}

/**
 * Section 6.4: Pre-LLM Clearance Isolation assertion.
 * Must be executed before invoking any AI provider or constructing an AI prompt.
 */
export function assertPreLlmClearanceIsolation(
  visibleSources: Array<Pick<SourceArtifact | SanitizedSource, 'id' | 'accessTier'>>,
  targetClearanceTier: ClearanceTier
): void {
  const allPermitted = visibleSources.every(
    (source) => source.accessTier <= targetClearanceTier
  );
  if (!allPermitted) {
    throw new Error(
      `Pre-LLM Clearance Isolation Violation: One or more sources exceed target clearance tier ${targetClearanceTier}`
    );
  }
}

export function filterSourcesForClearance(
  sources: SourceArtifact[],
  effectiveUserTier: ClearanceTier
): SourceArtifact[] {
  return filterByClearance(sources, effectiveUserTier);
}

export function filterInterviewsByClearance(
  interviews: ExitInterview[],
  effectiveUserTier: ClearanceTier
): ExitInterview[] {
  return filterByClearance(interviews, effectiveUserTier);
}

export function filterContributorsByClearance(
  contributors: Contributor[],
  effectiveUserTier: ClearanceTier
): Contributor[] {
  return filterByClearance(contributors, effectiveUserTier);
}

export function filterAuditLogsByClearance(
  logs: AuditLog[],
  effectiveUserTier: ClearanceTier
): AuditLog[] {
  return filterByClearance(logs, effectiveUserTier);
}
