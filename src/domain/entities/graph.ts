import { ClearanceTier } from '../../types';

export type GraphNodeType =
  | 'CONTRIBUTOR'
  | 'SOURCE'
  | 'MODULE'
  | 'SERVICE'
  | 'CLAIM'
  | 'INTERVIEW';

export interface DependencyGraphNode {
  id: string;
  projectId: string;
  nodeType: GraphNodeType;
  label: string;
  sublabel: string;
  accessTier: ClearanceTier;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  metadata: Record<string, string | number | boolean | null>;
}

export interface DependencyEdge {
  id: string;
  organizationId: string;
  projectId: string;
  sourceNodeId: string;
  targetNodeId: string;
  relationship:
    | 'OWNS_MODULE'
    | 'DEPENDS_ON'
    | 'EVIDENCES_CLAIM'
    | 'IMPACTS_SERVICE'
    | 'BLOCKS_WORK'
    | 'INTERVIEW_GAP';
  accessTier: ClearanceTier;
  weight: number;
}

export interface DependencyGraphPayload {
  nodes: DependencyGraphNode[];
  edges: DependencyEdge[];
  blastRadiusSummary: {
    criticalNodesCount: number;
    singlePointOfFailureModules: string[];
    unverifiedDependencyCount: number;
  };
}
