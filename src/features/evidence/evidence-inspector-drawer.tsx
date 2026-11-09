'use client';

import { X, CheckCircle2, FileText, ShieldAlert } from 'lucide-react';
import { useProjectWorkspace } from '../../hooks/use-project-workspace';
import { ClaimStatusBadge } from '../../components/shared/claim-status-badge';
import { ClearanceBadge } from '../../components/shared/clearance-badge';
import {
  formatClaimCategoryLabel,
  formatShortTimestamp,
  formatSourceTypeLabel,
} from '../../lib/utils';

export function EvidenceInspectorDrawer() {
  const { inspectedEvidence, closeEvidenceDrawer, sources } =
    useProjectWorkspace();

  if (!inspectedEvidence) {
    return null;
  }

  const { claim, citationIndex } = inspectedEvidence;
  const citation = claim.citations[citationIndex] || claim.citations[0];
  const source =
    inspectedEvidence.source ||
    (citation ? sources.find((s) => s.id === citation.sourceId) : undefined);

  const sanitizedText = source?.sanitizedContent || '';
  const hasValidSlice =
    citation &&
    citation.charStart >= 0 &&
    citation.charEnd <= sanitizedText.length &&
    citation.charEnd > citation.charStart;

  const prefixText = hasValidSlice
    ? sanitizedText.slice(0, citation.charStart)
    : '';
  const highlightedText = hasValidSlice
    ? sanitizedText.slice(citation.charStart, citation.charEnd)
    : citation?.verbatimQuote || '';
  const suffixText = hasValidSlice
    ? sanitizedText.slice(citation.charEnd)
    : sanitizedText;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 h-full overflow-y-auto p-6 flex flex-col justify-between">
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>Evidence Provenance Inspector</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">{claim.id}</span>
                <span aria-hidden="true">·</span>
                <ClearanceBadge tier={claim.accessTier} />
              </div>
              <h2 className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                {claim.title}
              </h2>
            </div>

            <button
              type="button"
              onClick={closeEvidenceDrawer}
              className="p-1.5 rounded-md border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white"
              aria-label="Close evidence drawer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Claim Metadata Summary */}
          <div className="space-y-3 border border-slate-200 dark:border-slate-800 rounded-lg p-4 bg-slate-50/70 dark:bg-slate-950/50">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
              <ClaimStatusBadge status={claim.verificationStatus} />
              <span aria-hidden="true">·</span>
              <span>{formatClaimCategoryLabel(claim.category)}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">Topic: {claim.topicKey}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">Stance: {claim.stanceValue}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                Origin: {claim.extractionOrigin}
              </span>
            </div>
            <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
              {claim.summary}
            </p>
          </div>

          {/* Citation Coordinate Proof */}
          {citation ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Grounded Citation Coordinate Proof</span>
                </h3>
                <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                  Offsets [{citation.charStart} : {citation.charEnd}] (
                  {citation.charEnd - citation.charStart} chars)
                </span>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 bg-white dark:bg-slate-950 space-y-3">
                {source ? (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-2.5">
                    <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {source.externalRef}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{formatSourceTypeLabel(source.sourceType)}</span>
                    <span aria-hidden="true">·</span>
                    <span>Author: @{source.authorHandle}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {formatShortTimestamp(source.createdAt)}
                    </span>
                  </div>
                ) : null}

                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                    Sanitized Source Artifact Content (highlighted at exact character slice{' '}
                    <code className="font-mono">
                      [{citation.charStart}:{citation.charEnd}]
                    </code>
                    ):
                  </div>
                  <div className="p-3.5 rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-xs leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                    {prefixText}
                    <mark className="bg-blue-500/20 dark:bg-blue-500/30 text-blue-950 dark:text-blue-100 px-1 py-0.5 rounded font-semibold underline decoration-blue-500">
                      {highlightedText}
                    </mark>
                    {suffixText}
                  </div>
                </div>

                {source && source.redactedCount > 0 ? (
                  <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300 pt-1">
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      SecretRedactor sanitized {source.redactedCount} sensitive
                      pattern(s) prior to computing character offsets.
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Claim State Machine Audit History */}
          <div className="space-y-2.5">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              State Machine Transition History ({claim.stateHistory.length})
            </h3>
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg divide-y divide-slate-200 dark:divide-slate-800">
              {claim.stateHistory.map((tr, i) => (
                <div
                  key={`${tr.timestamp}-${i}`}
                  className="p-3 text-xs space-y-1 bg-white dark:bg-slate-950"
                >
                  <div className="flex items-center justify-between font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    <span>
                      {tr.from} →{' '}
                      <strong className="text-slate-900 dark:text-slate-100">
                        {tr.to}
                      </strong>
                    </span>
                    <span>
                      {tr.actorType} ({tr.actorId}) ·{' '}
                      {formatShortTimestamp(tr.timestamp)}
                    </span>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300">
                    {tr.reason}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={closeEvidenceDrawer}
            className="px-4 py-2 text-xs font-medium rounded-lg bg-slate-900 text-white dark:bg-slate-800 hover:opacity-90"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
}
