'use client';

import { Cpu, Sparkles, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useProjectWorkspace } from '../../hooks/use-project-workspace';

export function ReconstructionControls() {
  const {
    project,
    session,
    isMutating,
    runReconstruction,
    verifyAllCitations,
  } = useProjectWorkspace();

  const canRun = session && !session.isShadowPreview;

  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-5 bg-white dark:bg-slate-900 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>Active Reconstruction Mode:</span>
          <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
            {project?.lastReconstructionMode || 'DETERMINISTIC'}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            Pre-LLM Clearance Isolation: Tier {session?.effectiveClearanceTier ?? 1}
          </span>
        </div>
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Knowledge Reconstruction & Citation Grounding Pipeline
        </h2>
        <p className="text-xs text-slate-600 dark:text-slate-400 max-w-2xl">
          Run deterministic lexical extraction (zero API key required), invoke Gemini AI enrichment (strictly isolated to sources ≤ Tier {session?.effectiveClearanceTier ?? 1}), or verify deterministic AI fallback resilience.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 shrink-0">
        <button
          type="button"
          disabled={!canRun || isMutating}
          onClick={() => runReconstruction({ useAiEnrichment: false })}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
        >
          <Cpu className="w-3.5 h-3.5" />
          <span>Run Deterministic</span>
        </button>

        <button
          type="button"
          disabled={!canRun || isMutating}
          onClick={() =>
            runReconstruction({ useAiEnrichment: true, provider: 'gemini' })
          }
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Run Gemini Enriched</span>
        </button>

        <button
          type="button"
          disabled={!canRun || isMutating}
          onClick={() =>
            runReconstruction({
              useAiEnrichment: true,
              provider: 'gemini',
              forceSimulateAiFailure: true,
            })
          }
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/50 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
          title="Test Section 11.4 Failure Handling: simulates AI provider timeout and verifies automatic fallback to deterministic reconstruction (AI_FALLBACK)"
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Test AI Fallback</span>
        </button>

        <button
          type="button"
          disabled={!canRun || isMutating}
          onClick={verifyAllCitations}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-slate-900 text-white dark:bg-slate-800 hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap shrink-0"
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Verify All Citations</span>
        </button>
      </div>
    </div>
  );
}
