import { useState, useMemo } from 'react';
import { DependencyGraphNode, GraphNodeType } from '../../types';
import { useProjectWorkspace } from '../../hooks/use-project-workspace';
import { ClearanceBadge } from '../../components/shared/clearance-badge';

const COLUMN_ORDER: GraphNodeType[] = [
  'CONTRIBUTOR',
  'MODULE',
  'SERVICE',
  'CLAIM',
  'SOURCE',
  'INTERVIEW',
];

const NODE_TYPE_COLORS: Record<
  GraphNodeType,
  { fill: string; stroke: string; text: string }
> = {
  CONTRIBUTOR: { fill: '#1e293b', stroke: '#3b82f6', text: '#93c5fd' },
  MODULE: { fill: '#1e293b', stroke: '#10b981', text: '#6ee7b7' },
  SERVICE: { fill: '#1e293b', stroke: '#f59e0b', text: '#fcd34d' },
  CLAIM: { fill: '#1e293b', stroke: '#ec4899', text: '#f9a8d4' },
  SOURCE: { fill: '#1e293b', stroke: '#64748b', text: '#cbd5e1' },
  INTERVIEW: { fill: '#1e293b', stroke: '#a855f7', text: '#d8b4fe' },
};

export function DependencyBlastGraph() {
  const { graph, claims, openEvidenceDrawer } = useProjectWorkspace();
  const [selectedType, setSelectedType] = useState<'ALL' | GraphNodeType>('ALL');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const layout = useMemo(() => {
    if (!graph) {
      return {
        positionedNodes: [] as Array<
          DependencyGraphNode & { x: number; y: number }
        >,
        coordsById: new Map<string, { x: number; y: number }>(),
      };
    }

    const filteredNodes = graph.nodes.filter((n) => {
      if (selectedType !== 'ALL' && n.nodeType !== selectedType) {
        return false;
      }
      return true;
    });

    // Limit dense SOURCE/CLAIM nodes in SVG for crisp legibility while keeping all MODULE/SERVICE/CONTRIBUTOR/INTERVIEW nodes
    const cappedNodes: DependencyGraphNode[] = [];
    const countsByType: Record<string, number> = {};
    for (const node of filteredNodes) {
      const c = countsByType[node.nodeType] || 0;
      const limit =
        node.nodeType === 'SOURCE' || node.nodeType === 'CLAIM' ? 8 : 12;
      if (c < limit) {
        cappedNodes.push(node);
        countsByType[node.nodeType] = c + 1;
      }
    }

    const grouped = new Map<GraphNodeType, DependencyGraphNode[]>();
    for (const col of COLUMN_ORDER) {
      grouped.set(
        col,
        cappedNodes.filter((n) => n.nodeType === col)
      );
    }

    const positionedNodes: Array<
      DependencyGraphNode & { x: number; y: number }
    > = [];
    const coordsById = new Map<string, { x: number; y: number }>();

    COLUMN_ORDER.forEach((colType, colIdx) => {
      const colNodes = grouped.get(colType) || [];
      const x = 105 + colIdx * 175;
      colNodes.forEach((node, rowIdx) => {
        const y = 70 + rowIdx * 62;
        positionedNodes.push({ ...node, x, y });
        coordsById.set(node.id, { x, y });
      });
    });

    return { positionedNodes, coordsById };
  }, [graph, selectedType]);

  if (!graph) {
    return null;
  }

  const selectedNode =
    graph.nodes.find((n) => n.id === selectedNodeId) ||
    layout.positionedNodes[0] ||
    null;

  const connectedEdges = selectedNode
    ? graph.edges.filter(
        (e) =>
          e.sourceNodeId === selectedNode.id ||
          e.targetNodeId === selectedNode.id
      )
    : [];

  return (
    <div className="space-y-4">
      {/* Blast Radius KPI Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 bg-white dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Clearance-Filtered Nodes & Edges
          </div>
          <div className="mt-1 text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {graph.nodes.length} nodes · {graph.edges.length} edges
          </div>
        </div>

        <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 bg-white dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            High / Critical Blast-Radius Nodes
          </div>
          <div className="mt-1 text-xl font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400">
            {graph.blastRadiusSummary.criticalNodesCount}
          </div>
        </div>

        <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 bg-white dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Single-Point-of-Failure Modules
          </div>
          <div className="mt-1 text-xs font-mono text-amber-600 dark:text-amber-400 truncate">
            {graph.blastRadiusSummary.singlePointOfFailureModules.join(', ') ||
              'None at current tier'}
          </div>
        </div>
      </div>

      {/* Interactive SVG Node-Link Visualization + Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
        <div className="lg:col-span-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-950 p-4 flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
            <span className="text-xs font-semibold text-slate-200">
              Interactive Dependency & Ownership Topology (Click any node to inspect)
            </span>

            <div className="flex flex-wrap items-center gap-1">
              {(
                [
                  ['ALL', 'All Layers'],
                  ['CONTRIBUTOR', 'Contributors'],
                  ['MODULE', 'Modules'],
                  ['SERVICE', 'Services'],
                  ['CLAIM', 'Claims'],
                  ['SOURCE', 'Sources'],
                  ['INTERVIEW', 'Interviews'],
                ] as const
              ).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setSelectedType(val)}
                  className={`px-2 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                    selectedType === val
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto my-2">
            <svg
              viewBox="0 0 1080 560"
              className="w-full h-[480px] select-none"
              role="img"
              aria-label="Project dependency and ownership graph"
            >
              {/* Column Layer Titles */}
              {COLUMN_ORDER.map((col, idx) => (
                <text
                  key={col}
                  x={105 + idx * 175}
                  y={28}
                  textAnchor="middle"
                  className="fill-slate-400 text-[11px] font-mono"
                >
                  {col}
                </text>
              ))}

              {/* Edges */}
              {graph.edges.map((edge) => {
                const src = layout.coordsById.get(edge.sourceNodeId);
                const dst = layout.coordsById.get(edge.targetNodeId);
                if (!src || !dst) return null;
                const isSelectedEdge =
                  selectedNode &&
                  (edge.sourceNodeId === selectedNode.id ||
                    edge.targetNodeId === selectedNode.id);

                return (
                  <line
                    key={edge.id}
                    x1={src.x}
                    y1={src.y}
                    x2={dst.x}
                    y2={dst.y}
                    stroke={isSelectedEdge ? '#38bdf8' : '#334155'}
                    strokeWidth={isSelectedEdge ? 2.2 : 1.1}
                    strokeOpacity={isSelectedEdge ? 0.95 : 0.55}
                  />
                );
              })}

              {/* Nodes */}
              {layout.positionedNodes.map((node) => {
                const palette = NODE_TYPE_COLORS[node.nodeType];
                const isSelected = selectedNode?.id === node.id;

                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x}, ${node.y})`}
                    onClick={() => setSelectedNodeId(node.id)}
                    className="cursor-pointer"
                  >
                    <rect
                      x={-74}
                      y={-20}
                      width={148}
                      height={40}
                      rx={6}
                      fill={palette.fill}
                      stroke={isSelected ? '#ffffff' : palette.stroke}
                      strokeWidth={isSelected ? 2.5 : 1.4}
                    />
                    <text
                      x={0}
                      y={-3}
                      textAnchor="middle"
                      fill="#f8fafc"
                      className="text-[10px] font-semibold"
                    >
                      {node.label.length > 20
                        ? node.label.slice(0, 19) + '…'
                        : node.label}
                    </text>
                    <text
                      x={0}
                      y={11}
                      textAnchor="middle"
                      fill={palette.text}
                      className="text-[9px] font-mono"
                    >
                      T{node.accessTier} · {node.riskLevel}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="text-[11px] font-mono text-slate-400 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
            <span>
              Server-side clearance filtering active: all nodes & edges strictly ≤ current effective tier.
            </span>
            <span>Click any node to inspect blast radius</span>
          </div>
        </div>

        {/* Click-to-inspect Node Detail Panel */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-5 bg-white dark:bg-slate-900 flex flex-col justify-between space-y-4">
          {selectedNode ? (
            <div className="space-y-4">
              <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-mono font-semibold">
                    {selectedNode.nodeType}
                  </span>
                  <ClearanceBadge tier={selectedNode.accessTier} />
                </div>
                <h3 className="mt-1 text-base font-bold text-slate-900 dark:text-slate-100">
                  {selectedNode.label}
                </h3>
                <p className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                  {selectedNode.sublabel}
                </p>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  Node Attributes
                </div>
                <div className="border border-slate-200 dark:border-slate-800 rounded-md p-3 bg-slate-50 dark:bg-slate-950 font-mono space-y-1">
                  <div>Risk Level: {selectedNode.riskLevel}</div>
                  {Object.entries(selectedNode.metadata).map(([k, v]) => (
                    <div key={k} className="truncate">
                      {k}: {String(v)}
                    </div>
                  ))}
                </div>
              </div>

              {selectedNode.nodeType === 'CLAIM' &&
              selectedNode.metadata.claimId ? (
                <button
                  type="button"
                  onClick={() => {
                    const matched = claims.find(
                      (c) => c.id === String(selectedNode.metadata.claimId)
                    );
                    if (matched) openEvidenceDrawer(matched, 0);
                  }}
                  className="w-full px-3 py-2 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors"
                >
                  Open Claim Citation in Evidence Inspector
                </button>
              ) : null}

              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Connected Dependency Edges ({connectedEdges.length})
                </div>
                <div className="max-h-56 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-md">
                  {connectedEdges.map((edge) => (
                    <div
                      key={edge.id}
                      className="p-2.5 text-xs font-mono bg-white dark:bg-slate-950"
                    >
                      <div className="text-blue-600 dark:text-blue-400">
                        {edge.relationship}
                      </div>
                      <div className="text-slate-600 dark:text-slate-400 truncate">
                        {edge.sourceNodeId} → {edge.targetNodeId}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-500">
              Select a node in the dependency graph to inspect its provenance and blast radius.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
