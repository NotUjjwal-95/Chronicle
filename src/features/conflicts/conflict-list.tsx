'use client';

import { useState } from 'react';
import { ConflictStatus } from '../../types';
import { useProjectWorkspace } from '../../hooks/use-project-workspace';
import { EmptyState } from '../../components/shared/empty-state';
import { ConflictResolutionCard } from './conflict-resolution-card';

export function ConflictList() {
  const { conflicts } = useProjectWorkspace();
  const [filter, setFilter] = useState<'ALL' | ConflictStatus>('ALL');

  const visible = conflicts.filter((c) =>
    filter === 'ALL' ? true : c.status === filter
  );

  return (
    <div className="space-y-4">
      <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Multi-Source Contradiction Registry
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Contradictions are never automatically resolved by recency or AI confidence. Winning claims transition to HUMAN_APPROVED and losing claims remain in history as SUPERSEDED.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-lg">
          {(
            [
              ['ALL', `All (${conflicts.length})`],
              [
                ConflictStatus.OPEN,
                `Open (${conflicts.filter((c) => c.status === ConflictStatus.OPEN).length})`,
              ],
              [
                ConflictStatus.RESOLVED,
                `Resolved (${conflicts.filter((c) => c.status === ConflictStatus.RESOLVED).length})`,
              ],
            ] as const
          ).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setFilter(val)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                filter === val
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="No Conflicts Match Current Filter"
          description="All visible multi-source contradictions in this view have been filtered or resolved."
        />
      ) : (
        <div className="space-y-4">
          {visible.map((conflict) => (
            <ConflictResolutionCard key={conflict.id} conflict={conflict} />
          ))}
        </div>
      )}
    </div>
  );
}
