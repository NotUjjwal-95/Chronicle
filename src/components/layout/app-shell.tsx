import { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Eye, X } from 'lucide-react';
import { useProjectWorkspace } from '../../hooks/use-project-workspace';
import { RoleClearanceBar } from './role-clearance-bar';
import { ProjectHeader } from './project-header';
import { StageNavBar } from './stage-nav-bar';
import { EvidenceInspectorDrawer } from '../../features/evidence/evidence-inspector-drawer';

export function AppShell({ children }: { children: ReactNode }) {
  const {
    project,
    session,
    currentPath,
    navigate,
    errorBanner,
    statusBanner,
    clearBanners,
  } = useProjectWorkspace();

  const pid = project?.id || 'proj-core-payments';

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="flex items-center justify-between gap-8 px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        {/* Zone 1: Single text element wordmark */}
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0 font-display text-left"
        >
          Chronicle
        </button>

        {/* Zone 2: 5 concise single-line navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className={`hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              currentPath === '/dashboard'
                ? 'text-blue-600 dark:text-blue-400 underline underline-offset-4'
                : ''
            }`}
          >
            Dashboard
          </button>
          <button
            type="button"
            onClick={() => navigate(`/projects/${pid}/sources`)}
            className={`hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              currentPath.endsWith('/sources')
                ? 'text-blue-600 dark:text-blue-400 underline underline-offset-4'
                : ''
            }`}
          >
            Sources
          </button>
          <button
            type="button"
            onClick={() => navigate(`/projects/${pid}/timeline`)}
            className={`hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              currentPath.endsWith('/timeline')
                ? 'text-blue-600 dark:text-blue-400 underline underline-offset-4'
                : ''
            }`}
          >
            Timeline
          </button>
          <button
            type="button"
            onClick={() => navigate(`/projects/${pid}/conflicts`)}
            className={`hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              currentPath.endsWith('/conflicts')
                ? 'text-blue-600 dark:text-blue-400 underline underline-offset-4'
                : ''
            }`}
          >
            Conflicts
          </button>
          <button
            type="button"
            onClick={() => navigate(`/projects/${pid}/graph`)}
            className={`hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              currentPath.endsWith('/graph')
                ? 'text-blue-600 dark:text-blue-400 underline underline-offset-4'
                : ''
            }`}
          >
            Graph
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => navigate(`/projects/${pid}/handover`)}
            className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            Handover Portal
          </button>
        </div>
      </header>

      {/* Workspace RBAC & Shadow Preview Control Toolbar */}
      <RoleClearanceBar />

      {/* Shadow Role Preview Notice */}
      {session?.isShadowPreview ? (
        <div className="border-b border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/60 px-6 py-2 flex items-center justify-between text-xs text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 shrink-0" />
            <span>
              <strong>Server-Enforced Shadow Role Preview Active:</strong> Viewing
              workspace strictly as Tier {session.effectiveClearanceTier}. All
              higher-tier sources, claims, conflicts, and graph edges are
              filtered server-side, and mutating operations are blocked.
            </span>
          </div>
        </div>
      ) : null}

      {/* Contextual Error / Status Feedback Banner */}
      {errorBanner ? (
        <div className="border-b border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/60 px-6 py-2.5 flex items-center justify-between text-xs text-rose-900 dark:text-rose-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <span>{errorBanner}</span>
          </div>
          <button
            type="button"
            onClick={clearBanners}
            className="p-1 hover:opacity-75"
            aria-label="Dismiss error banner"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : null}

      {statusBanner ? (
        <div className="border-b border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 px-6 py-2.5 flex items-center justify-between text-xs text-emerald-900 dark:text-emerald-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{statusBanner}</span>
          </div>
          <button
            type="button"
            onClick={clearBanners}
            className="p-1 hover:opacity-75"
            aria-label="Dismiss status banner"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : null}

      {currentPath !== '/dashboard' ? (
        <>
          <ProjectHeader />
          <StageNavBar />
        </>
      ) : null}

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-6 py-6">
        {children}
      </main>

      <EvidenceInspectorDrawer />
    </div>
  );
}
