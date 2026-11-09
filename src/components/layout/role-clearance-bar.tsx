'use client';

import { useState } from 'react';
import { Eye, Sun, Moon, RotateCcw } from 'lucide-react';
import { ClearanceTier, ProjectRole } from '../../types';
import { useProjectWorkspace } from '../../hooks/use-project-workspace';
import { ClearanceBadge } from '../shared/clearance-badge';

export function RoleClearanceBar() {
  const {
    session,
    availablePersonas,
    persistenceMode,
    isMutating,
    switchSessionPersona,
    resetWorkspaceToSeed,
  } = useProjectWorkspace();

  const [isDark, setIsDark] = useState<boolean>(() =>
    typeof document !== 'undefined'
      ? document.documentElement.classList.contains('dark')
      : true
  );

  const toggleTheme = () => {
    if (typeof document === 'undefined') return;
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  if (!session) {
    return null;
  }

  const canUseShadowPreview =
    session.role === ProjectRole.MAINTAINER &&
    session.actualClearanceTier === ClearanceTier.TIER_3_CONFIDENTIAL;

  return (
    <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900/90 px-6 py-2.5 flex flex-wrap items-center justify-between gap-4 text-xs">
      <div className="flex flex-wrap items-center gap-3 text-slate-600 dark:text-slate-300">
        <span className="font-medium text-slate-900 dark:text-slate-100">
          Active Identity:
        </span>
        <select
          aria-label="Select authenticated session persona"
          value={session.userId}
          disabled={isMutating}
          onChange={(e) => switchSessionPersona(e.target.value, null)}
          className="px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {availablePersonas.map((p) => (
            <option key={p.userId} value={p.userId}>
              {p.displayName} — {p.description}
            </option>
          ))}
        </select>
        <span aria-hidden="true" className="text-slate-400">
          ·
        </span>
        <span>Role: {session.role}</span>
        <span aria-hidden="true" className="text-slate-400">
          ·
        </span>
        <ClearanceBadge tier={session.effectiveClearanceTier} />
        <span aria-hidden="true" className="text-slate-400">
          ·
        </span>
        <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
          Persistence: {persistenceMode}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {canUseShadowPreview ? (
          <div className="flex items-center gap-1 p-0.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950">
            <span className="inline-flex items-center gap-1 px-2 py-1 text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">
              <Eye className="w-3.5 h-3.5" />
              <span>Shadow Preview:</span>
            </span>
            <button
              type="button"
              disabled={isMutating}
              onClick={() => switchSessionPersona(session.userId, null)}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                !session.isShadowPreview
                  ? 'bg-slate-900 text-white dark:bg-blue-600 dark:text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Off (Tier 3)
            </button>
            <button
              type="button"
              disabled={isMutating}
              onClick={() =>
                switchSessionPersona(
                  session.userId,
                  ClearanceTier.TIER_2_INTERNAL
                )
              }
              className={`px-2 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                session.isShadowPreview &&
                session.effectiveClearanceTier === ClearanceTier.TIER_2_INTERNAL
                  ? 'bg-amber-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Preview Tier 2
            </button>
            <button
              type="button"
              disabled={isMutating}
              onClick={() =>
                switchSessionPersona(
                  session.userId,
                  ClearanceTier.TIER_1_EXTERNAL
                )
              }
              className={`px-2 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                session.isShadowPreview &&
                session.effectiveClearanceTier === ClearanceTier.TIER_1_EXTERNAL
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Preview Tier 1
            </button>
          </div>
        ) : null}

        {session.role === ProjectRole.MAINTAINER && !session.isShadowPreview ? (
          <button
            type="button"
            disabled={isMutating}
            onClick={resetWorkspaceToSeed}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            title="Reset demonstration workspace to 28-artifact baseline"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Seed</span>
          </button>
        ) : null}

        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle color theme"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
        >
          {isDark ? (
            <>
              <Sun className="w-3.5 h-3.5" />
              <span>Light</span>
            </>
          ) : (
            <>
              <Moon className="w-3.5 h-3.5" />
              <span>Dark</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
