'use client';

import { DependencyBlastGraph } from '../../../../features/graph/dependency-blast-graph';
import { ContributorOwnershipMatrix } from '../../../../features/graph/contributor-ownership-matrix';

export default function GraphPage() {
  return (
    <div className="space-y-6">
      <DependencyBlastGraph />
      <ContributorOwnershipMatrix />
    </div>
  );
}

