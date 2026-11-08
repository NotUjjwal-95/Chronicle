import { useProjectWorkspace } from '../../hooks/use-project-workspace';
import { formatShortTimestamp } from '../../lib/utils';

export function ProjectHeader() {
  const { project, metrics, session } = useProjectWorkspace();

  if (!project || !metrics) {
    return null;
  }

  return (
    <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-5">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>Organization: Chronicle Financial Infrastructure</span>
            <span aria-hidden="true">·</span>
            <span>Departing Lead: @{project.departingLeadHandle}</span>
            <span aria-hidden="true">·</span>
            <span>Incoming Owner: @{project.incomingLeadHandle}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              Mode: {project.lastReconstructionMode || 'DETERMINISTIC'}
            </span>
            {project.lastReconstructedAt ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  Reconstructed {formatShortTimestamp(project.lastReconstructedAt)}
                </span>
              </>
            ) : null}
          </div>

          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {project.name}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 max-w-3xl">
            {project.description}
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border border-slate-200 dark:border-slate-800 rounded-lg p-3.5 bg-slate-50/70 dark:bg-slate-950/60 shrink-0">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Visible Artifacts
            </div>
            <div className="mt-0.5 text-lg font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
              {metrics.totalSources}
            </div>
            <div className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {metrics.redactedSecretsCount} secrets redacted
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Grounded Claims
            </div>
            <div className="mt-0.5 text-lg font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
              {metrics.verifiedClaims + metrics.humanApprovedClaims} / {metrics.totalClaims}
            </div>
            <div className="text-xs font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
              {metrics.humanApprovedClaims} human approved
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Contradictions
            </div>
            <div className="mt-0.5 text-lg font-semibold font-mono tabular-nums text-rose-600 dark:text-rose-400">
              {metrics.openConflicts} open
            </div>
            <div className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {metrics.resolvedConflicts} resolved
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Handover Readiness
            </div>
            <div className="mt-0.5 text-lg font-semibold font-mono tabular-nums text-blue-600 dark:text-blue-400">
              {metrics.readinessPercentage}%
            </div>
            <div className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              Tier {session?.effectiveClearanceTier ?? 1} scope
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
