'use client';

import { ArrowRight, FolderGit2, Shield, Users, Clock } from 'lucide-react';
import { useProjectWorkspace } from '../../hooks/use-project-workspace';
import { AppShell } from '../../components/layout/app-shell';
import { formatShortTimestamp } from '../../lib/utils';
import { ClearanceBadge } from '../../components/shared/clearance-badge';

export default function DashboardPage() {
  const { projects, project, metrics, session, navigate } =
    useProjectWorkspace();

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-6 bg-white dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold font-display text-slate-900 dark:text-slate-100">
                Chronicle Engineering Workspaces
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
                Cryptographically verifiable, conflict-aware project knowledge reconstruction and service handover intelligence.
              </p>
            </div>
            {session ? (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 dark:text-slate-400">Authenticated:</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {session.displayName}
                </span>
                <ClearanceBadge tier={session.effectiveClearanceTier} />
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((proj) => (
            <div
              key={proj.id}
              className="border border-slate-200 dark:border-slate-800 rounded-lg p-5 bg-white dark:bg-slate-900 flex flex-col justify-between space-y-4 hover:border-blue-500 dark:hover:border-blue-500 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-mono text-slate-400">{proj.slug}</span>
                  <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900">
                    {proj.lastReconstructionMode}
                  </span>
                </div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  {proj.name}
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 line-clamp-3">
                  {proj.description}
                </p>
              </div>

              <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                  <span>Departing Lead:</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">
                    @{proj.departingLeadHandle}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                  <span>Incoming Lead:</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">
                    @{proj.incomingLeadHandle}
                  </span>
                </div>
                {metrics ? (
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-slate-500 dark:text-slate-400">Readiness:</span>
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                      {metrics.readinessPercentage}% ({metrics.verifiedClaims}/{metrics.totalClaims} verified)
                    </span>
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => navigate(`/projects/${proj.id}`)}
                  className="w-full mt-2 py-2 px-3 text-xs font-medium rounded-lg bg-slate-900 dark:bg-blue-600 text-white hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5"
                >
                  <span>Open Knowledge Workspace</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
