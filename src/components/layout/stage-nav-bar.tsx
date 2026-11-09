'use client';

import { useProjectWorkspace } from '../../hooks/use-project-workspace';

export function StageNavBar() {
  const { project, metrics, currentPath, navigate } = useProjectWorkspace();
  const pid = project?.id || 'proj-core-payments';

  const stages = [
    {
      step: '01',
      label: 'Overview & Verification',
      path: `/projects/${pid}`,
      count: metrics ? `${metrics.readinessPercentage}%` : undefined,
    },
    {
      step: '02',
      label: 'Sources & Redaction',
      path: `/projects/${pid}/sources`,
      count: metrics ? String(metrics.totalSources) : undefined,
    },
    {
      step: '03',
      label: 'Reconstruction & Claims',
      path: `/projects/${pid}/timeline`,
      count: metrics ? String(metrics.totalClaims) : undefined,
    },
    {
      step: '04',
      label: 'Conflict Resolution',
      path: `/projects/${pid}/conflicts`,
      count: metrics ? `${metrics.openConflicts} open` : undefined,
    },
    {
      step: '05',
      label: 'Exit Interviews',
      path: `/projects/${pid}/interviews`,
      count: metrics ? `${metrics.pendingInterviews} pending` : undefined,
    },
    {
      step: '06',
      label: 'Dependency Graph',
      path: `/projects/${pid}/graph`,
      count: undefined,
    },
    {
      step: '07',
      label: 'Handover & Digest',
      path: `/projects/${pid}/handover`,
      count: metrics ? `${metrics.snapshotsCount} locked` : undefined,
    },
    {
      step: '08',
      label: 'Governance Settings',
      path: `/projects/${pid}/settings`,
      count: undefined,
    },
  ];

  return (
    <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-2 overflow-x-auto">
      <div className="flex items-center gap-1.5 min-w-max">
        {stages.map((stage) => {
          const isActive = currentPath === stage.path;
          return (
            <button
              key={stage.path}
              type="button"
              onClick={() => navigate(stage.path)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 ${
                isActive
                  ? 'bg-slate-900 text-white dark:bg-blue-600 dark:text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <span className="font-mono tabular-nums opacity-75">
                {stage.step}.
              </span>
              <span>{stage.label}</span>
              {stage.count !== undefined ? (
                <span className="font-mono tabular-nums text-[11px] opacity-80">
                  ({stage.count})
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
