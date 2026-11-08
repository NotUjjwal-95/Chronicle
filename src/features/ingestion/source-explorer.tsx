import { useState } from 'react';
import { Search, ShieldAlert } from 'lucide-react';
import { SourceType } from '../../types';
import { useProjectWorkspace } from '../../hooks/use-project-workspace';
import { ClearanceBadge } from '../../components/shared/clearance-badge';
import { EmptyState } from '../../components/shared/empty-state';
import {
  formatShortTimestamp,
  formatSourceTypeLabel,
} from '../../lib/utils';

export function SourceExplorer() {
  const { sources } = useProjectWorkspace();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<'ALL' | SourceType>('ALL');
  const [onlyRedacted, setOnlyRedacted] = useState(false);

  const filtered = sources.filter((src) => {
    if (selectedType !== 'ALL' && src.sourceType !== selectedType) {
      return false;
    }
    if (onlyRedacted && src.redactedCount === 0) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        src.title.toLowerCase().includes(q) ||
        src.externalRef.toLowerCase().includes(q) ||
        src.sanitizedContent.toLowerCase().includes(q) ||
        src.authorHandle.toLowerCase().includes(q) ||
        src.modulePaths.some((m) => m.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Interactive Filter Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border border-slate-200 dark:border-slate-800 rounded-lg p-4 bg-white dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-lg">
          {(
            [
              ['ALL', 'All Artifacts'],
              [SourceType.GITHUB_PR, 'GitHub PRs'],
              [SourceType.SLACK_THREAD, 'Slack Threads'],
              [SourceType.JIRA_TICKET, 'Jira Tickets'],
              [SourceType.NOTION_DOC, 'Notion Docs'],
              [SourceType.CUSTOM_NOTE, 'Custom Notes'],
            ] as const
          ).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setSelectedType(val)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                selectedType === val
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setOnlyRedacted(!onlyRedacted)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 ${
              onlyRedacted
                ? 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
            }`}
          >
            Redacted Secrets Only
          </button>

          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ref, module, content..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No Matching Source Artifacts"
          description="Adjust your search query or clearance tier filter to view ingested artifacts."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((source) => (
            <div
              key={source.id}
              className="border border-slate-200 dark:border-slate-800 rounded-lg p-5 bg-white dark:bg-slate-900 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                    {source.externalRef}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{formatSourceTypeLabel(source.sourceType)}</span>
                  <span aria-hidden="true">·</span>
                  <span>@{source.authorHandle}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    {formatShortTimestamp(source.createdAt)}
                  </span>
                  {source.modulePaths.length > 0 ? (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono text-blue-600 dark:text-blue-400">
                        {source.modulePaths.join(', ')}
                      </span>
                    </>
                  ) : null}
                </div>

                <ClearanceBadge tier={source.accessTier} />
              </div>

              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {source.title}
              </h3>

              <div className="p-3 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                {source.sanitizedContent}
              </div>

              {source.redactedCount > 0 ? (
                <div className="flex flex-wrap items-center gap-2 text-xs text-amber-700 dark:text-amber-400 pt-1">
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Sanitized {source.redactedCount} secret(s):
                  </span>
                  {source.redactionMetadata.map((meta, idx) => (
                    <span
                      key={`${source.id}-red-${idx}`}
                      className="font-mono tabular-nums"
                    >
                      {meta.patternType} [{meta.sanitizedStart}:{meta.sanitizedEnd}]
                      {idx < source.redactionMetadata.length - 1 ? ' · ' : ''}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
