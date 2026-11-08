import { Quote } from 'lucide-react';
import { ClaimCitation } from '../../types';

export function CitationChip({
  citation,
  onClick,
}: {
  citation: ClaimCitation;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 px-2.5 py-1 text-xs font-mono tabular-nums rounded-md border border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-blue-500 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors whitespace-nowrap shrink-0"
      title={`Inspect verbatim quote in ${citation.sourceExternalRef || citation.sourceId} (offsets ${citation.charStart}–${citation.charEnd})`}
    >
      <Quote className="w-3 h-3 shrink-0 text-blue-600 dark:text-blue-400" />
      <span>{citation.sourceExternalRef || citation.sourceId}</span>
      <span aria-hidden="true" className="text-slate-400">
        ·
      </span>
      <span>
        [{citation.charStart}:{citation.charEnd}]
      </span>
    </button>
  );
}
