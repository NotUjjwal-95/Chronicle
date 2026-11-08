import {
  Claim,
  ClaimVerificationStatus,
  ClearanceTier,
  Contributor,
  DependencyEdge,
  DependencyGraphNode,
  DependencyGraphPayload,
  ExitInterview,
  InterviewStatus,
  SourceArtifact,
} from '../../types';
import { filterGraphByClearance } from '../../security/clearance-policy';

/**
 * Builds the project dependency and ownership blast-radius graph and enforces server-side clearance filtering.
 * Represents Contributors, Sources, Modules, Services, Claims, and Interviews.
 */
export function buildDependencyGraph(params: {
  projectId: string;
  organizationId: string;
  contributors: Contributor[];
  sources: SourceArtifact[];
  claims: Claim[];
  interviews: ExitInterview[];
  explicitEdges: DependencyEdge[];
  effectiveClearanceTier: ClearanceTier;
}): DependencyGraphPayload {
  const {
    projectId,
    organizationId,
    contributors,
    sources,
    claims,
    interviews,
    explicitEdges,
    effectiveClearanceTier,
  } = params;

  const nodesMap = new Map<string, DependencyGraphNode>();
  const edgesMap = new Map<string, DependencyEdge>();

  const addNode = (node: DependencyGraphNode) => {
    if (!nodesMap.has(node.id)) {
      nodesMap.set(node.id, node);
    }
  };

  const addEdge = (edge: DependencyEdge) => {
    if (!edgesMap.has(edge.id)) {
      edgesMap.set(edge.id, edge);
    }
  };

  // 1. Service nodes
  const coreServices = [
    {
      id: 'service:core-payments-api',
      label: 'Core Payments API',
      sublabel: 'Primary Settlement & Charge Service',
      accessTier: ClearanceTier.TIER_1_EXTERNAL,
      riskLevel: 'HIGH' as const,
    },
    {
      id: 'service:PostgreSQL-Ledger',
      label: 'PostgreSQL Ledger & Outbox',
      sublabel: 'ACID Settlement Store',
      accessTier: ClearanceTier.TIER_2_INTERNAL,
      riskLevel: 'MEDIUM' as const,
    },
    {
      id: 'service:Stripe-Webhook-Gateway',
      label: 'Stripe Webhook Gateway',
      sublabel: 'External Settlement Provider',
      accessTier: ClearanceTier.TIER_2_INTERNAL,
      riskLevel: 'HIGH' as const,
    },
    {
      id: 'service:HSM-Key-Vault',
      label: 'Internal HSM Key Vault',
      sublabel: 'Confidential Key Rotation Service',
      accessTier: ClearanceTier.TIER_3_CONFIDENTIAL,
      riskLevel: 'CRITICAL' as const,
    },
  ];

  for (const svc of coreServices) {
    addNode({
      id: svc.id,
      projectId,
      nodeType: 'SERVICE',
      label: svc.label,
      sublabel: svc.sublabel,
      accessTier: svc.accessTier,
      riskLevel: svc.riskLevel,
      metadata: { category: 'Infrastructure Service' },
    });
  }

  // 2. Contributor nodes
  for (const contributor of contributors) {
    const nodeId = `contributor:${contributor.handle}`;
    addNode({
      id: nodeId,
      projectId,
      nodeType: 'CONTRIBUTOR',
      label: contributor.displayName,
      sublabel: `@${contributor.handle} · ${contributor.departureStatus}`,
      accessTier: contributor.accessTier,
      riskLevel: contributor.departureStatus === 'DEPARTING' ? 'CRITICAL' : 'LOW',
      metadata: {
        handle: contributor.handle,
        roleTitle: contributor.roleTitle,
        departureStatus: contributor.departureStatus,
        primaryDomains: contributor.primaryDomains.join(', '),
      },
    });

    for (const modPath of contributor.primaryDomains) {
      const modNodeId = `module:${modPath}`;
      addNode({
        id: modNodeId,
        projectId,
        nodeType: 'MODULE',
        label: modPath.split('/').pop() || modPath,
        sublabel: modPath,
        accessTier: contributor.accessTier,
        riskLevel: contributor.departureStatus === 'DEPARTING' ? 'HIGH' : 'MEDIUM',
        metadata: {
          modulePath: modPath,
          primaryOwner: contributor.handle,
          ownerStatus: contributor.departureStatus,
        },
      });

      addEdge({
        id: `edge-own-${contributor.handle}-${modPath}`,
        organizationId,
        projectId,
        sourceNodeId: nodeId,
        targetNodeId: modNodeId,
        relationship: 'OWNS_MODULE',
        accessTier: contributor.accessTier,
        weight: 2,
      });
    }
  }

  // 3. Source nodes & module couplings
  for (const source of sources) {
    const srcNodeId = `source:${source.id}`;
    addNode({
      id: srcNodeId,
      projectId,
      nodeType: 'SOURCE',
      label: source.externalRef,
      sublabel: source.title,
      accessTier: source.accessTier,
      riskLevel: source.redactedCount > 0 ? 'HIGH' : 'LOW',
      metadata: {
        sourceId: source.id,
        sourceType: source.sourceType,
        authorHandle: source.authorHandle,
        redactedCount: source.redactedCount,
      },
    });

    for (const modPath of source.modulePaths) {
      const modNodeId = `module:${modPath}`;
      if (!nodesMap.has(modNodeId)) {
        addNode({
          id: modNodeId,
          projectId,
          nodeType: 'MODULE',
          label: modPath.split('/').pop() || modPath,
          sublabel: modPath,
          accessTier: source.accessTier,
          riskLevel: 'MEDIUM',
          metadata: { modulePath: modPath },
        });
      }
    }
  }

  // 4. Claim nodes and evidence edges
  for (const claim of claims) {
    if (
      claim.verificationStatus === ClaimVerificationStatus.SUPERSEDED ||
      claim.verificationStatus === ClaimVerificationStatus.REJECTED
    ) {
      continue;
    }

    const claimNodeId = `claim:${claim.id}`;
    const isHighRisk =
      claim.verificationStatus === ClaimVerificationStatus.CONFLICTED ||
      claim.verificationStatus === ClaimVerificationStatus.MISSING_EVIDENCE;

    addNode({
      id: claimNodeId,
      projectId,
      nodeType: 'CLAIM',
      label: claim.title.slice(0, 42),
      sublabel: `${claim.category} · ${claim.verificationStatus}`,
      accessTier: claim.accessTier,
      riskLevel: isHighRisk ? 'CRITICAL' : 'MEDIUM',
      metadata: {
        claimId: claim.id,
        category: claim.category,
        verificationStatus: claim.verificationStatus,
        topicKey: claim.topicKey,
        stanceValue: claim.stanceValue,
      },
    });

    for (const citation of claim.citations) {
      const srcNodeId = `source:${citation.sourceId}`;
      addEdge({
        id: `edge-cit-${citation.id}`,
        organizationId,
        projectId,
        sourceNodeId: srcNodeId,
        targetNodeId: claimNodeId,
        relationship: 'EVIDENCES_CLAIM',
        accessTier: Math.max(claim.accessTier, citation.accessTier) as ClearanceTier,
        weight: 1,
      });
    }

    for (const modPath of claim.modulePaths) {
      const modNodeId = `module:${modPath}`;
      if (!nodesMap.has(modNodeId)) {
        addNode({
          id: modNodeId,
          projectId,
          nodeType: 'MODULE',
          label: modPath.split('/').pop() || modPath,
          sublabel: modPath,
          accessTier: claim.accessTier,
          riskLevel: 'HIGH',
          metadata: { modulePath: modPath },
        });
      }

      addEdge({
        id: `edge-claim-mod-${claim.id}-${modPath}`,
        organizationId,
        projectId,
        sourceNodeId: claimNodeId,
        targetNodeId: modNodeId,
        relationship: 'DEPENDS_ON',
        accessTier: claim.accessTier,
        weight: 2,
      });
    }
  }

  // 5. Interview nodes
  for (const interview of interviews) {
    const intNodeId = `interview:${interview.id}`;
    addNode({
      id: intNodeId,
      projectId,
      nodeType: 'INTERVIEW',
      label: `Exit Interview: ${interview.topicKey}`,
      sublabel: `${interview.status} · @${interview.contributorHandle}`,
      accessTier: interview.accessTier,
      riskLevel: interview.status === InterviewStatus.PENDING ? 'HIGH' : 'LOW',
      metadata: {
        interviewId: interview.id,
        status: interview.status,
        modulePath: interview.modulePath,
        question: interview.question,
      },
    });

    const modNodeId = `module:${interview.modulePath}`;
    if (nodesMap.has(modNodeId)) {
      addEdge({
        id: `edge-int-mod-${interview.id}`,
        organizationId,
        projectId,
        sourceNodeId: intNodeId,
        targetNodeId: modNodeId,
        relationship: 'INTERVIEW_GAP',
        accessTier: interview.accessTier,
        weight: 2,
      });
    }
  }

  // 6. Explicit dependency edges
  for (const edge of explicitEdges) {
    addEdge(edge);
  }

  // 7. Server-side clearance filter (never leak higher-clearance nodes or edges)
  const filtered = filterGraphByClearance(
    Array.from(nodesMap.values()),
    Array.from(edgesMap.values()),
    effectiveClearanceTier
  );

  // 8. Compute Blast Radius Summary strictly from clearance-visible nodes
  const criticalNodesCount = filtered.nodes.filter(
    (n) => n.riskLevel === 'CRITICAL' || n.riskLevel === 'HIGH'
  ).length;

  const singlePointOfFailureModules = filtered.nodes
    .filter(
      (n) =>
        n.nodeType === 'MODULE' &&
        (n.riskLevel === 'CRITICAL' || n.riskLevel === 'HIGH')
    )
    .map((n) => n.sublabel);

  const unverifiedDependencyCount = filtered.nodes.filter(
    (n) =>
      n.nodeType === 'CLAIM' &&
      (n.metadata.verificationStatus === ClaimVerificationStatus.MISSING_EVIDENCE ||
        n.metadata.verificationStatus === ClaimVerificationStatus.CONFLICTED)
  ).length;

  return {
    nodes: filtered.nodes,
    edges: filtered.edges,
    blastRadiusSummary: {
      criticalNodesCount,
      singlePointOfFailureModules,
      unverifiedDependencyCount,
    },
  };
}
