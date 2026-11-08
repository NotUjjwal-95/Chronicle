import { useState, FormEvent } from 'react';
import { CheckCircle2, GitMerge } from 'lucide-react';
import {
  Conflict,
  ConflictResolutionOption,
  ConflictStatus,
  ProjectRole,
} from '../../types';
import { useProjectWorkspace } from '../../hooks/use-project-workspace';
import { ClearanceBadge } from '../../components/shared/clearance-badge';
import { ClaimStatusBadge } from '../../components/shared/claim-status-badge';
import { CitationChip } from '../../components/shared/citation-chip';
import { formatShortTimestamp } from '../../lib/utils';

export function ConflictResolutionCard({ conflict }: { conflict: Conflict }) {
  const {
    claims,
    session,
    isMutating,
    openEvidenceDrawer,
    resolveConflict,
  } = useProjectWorkspace();

  const claimA = claims.find((c) => c.id === conflict.claimAId);
  const claimB = claims.find((c) => c.id === conflict.claimBId);
  const synthClaim = conflict.synthesizedClaimId
    ? claims.find((c) => c.id === conflict.synthesizedClaimId)
    : undefined;

  const [option, setOption] = useState<ConflictResolutionOption>(
    ConflictResolutionOption.CLAIM_A
  );
  const [rationale, setRationale] = useState(
    `Verified production code in ${claimA?.citations[0]?.sourceExternalRef || 'PR'} supersedes the stale architecture runbook in ${claimB?.citations[0]?.sourceExternalRef || 'Notion'}.`
  );
  const [synthTitle, setSynthTitle] = useState(
    `Synthesized Consensus on ${conflict.topicKey}`
  );
  const [synthSummary, setSynthSummary] = useState(
    `Production enforces ${claimA?.stanceValue || 'primary implementation'} while legacy documentation is scheduled for immediate update.`
  );
  const [createNotionNextAction, setCreateNotionNextAction] = useState(true);

  const canResolve =
    session &&
    !session.isShadowPreview &&
    (session.role === ProjectRole.MAINTAINER ||
      session.role === ProjectRole.REVIEWER);

  const handleResolve = async (e: FormEvent) => {
    e.preventDefault();
    if (!canResolve) return;
    await resolveConflict(conflict.id, {
      resolutionOption: option,
      rationale,
      synthesizedTitle:
        option === ConflictResolutionOption.SYNTHESIZE ? synthTitle : undefined,
      synthesizedSummary:
        option === ConflictResolutionOption.SYNTHESIZE
          ? synthSummary
          : undefined,
      synthesizedStanceValue:
        option === ConflictResolutionOption.SYNTHESIZE
          ? 'SYNTHESIZED_CONSENSUS'
          : undefined,
      createNotionUpdateNextAction: createNotionNextAction,
    });
  };

  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-6 bg-white dark:bg-slate-900 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
              {conflict.id}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">Topic: {conflict.topicKey}</span>
            <span aria-hidden="true">·</span>
            <span>
              Status:{' '}
              <strong
                className={
                  conflict.status === ConflictStatus.OPEN
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }
              >
                {conflict.status}
              </strong>
            </span>
          </div>
          <h3 className="mt-1 text-base font-bold text-slate-900 dark:text-slate-100">
            {conflict.title}
          </h3>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            {conflict.description}
          </p>
        </div>

        <ClearanceBadge tier={conflict.accessTier} />
      </div>

      {/* Side-by-side Claim A vs Claim B comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
        {[
          { label: 'Claim A', claim: claimA },
          { label: 'Claim B', claim: claimB },
        ].map(({ label, claim }) => (
          <div
            key={label}
            className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 bg-slate-50/60 dark:bg-slate-950/60 flex flex-col justify-between space-y-3"
          >
            {claim ? (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                      {label} ({claim.id})
                    </span>
                    <ClaimStatusBadge status={claim.verificationStatus} />
                  </div>

                  <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                    Stance: <strong>{claim.stanceValue}</strong> · Created{' '}
                    {formatShortTimestamp(claim.createdAt)}
                  </div>

                  <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {claim.title}
                  </h4>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                    {claim.summary}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center gap-2">
                  {claim.citations.map((cit, idx) => (
                    <CitationChip
                      key={cit.id}
                      citation={cit}
                      onClick={() => openEvidenceDrawer(claim, idx)}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="text-xs text-slate-500">
                Associated claim record unavailable at this clearance level.
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Resolution state or atomic resolution form */}
      {conflict.status === ConflictStatus.RESOLVED ? (
        <div className="border border-emerald-200 dark:border-emerald-900/60 rounded-lg p-4 bg-emerald-50/40 dark:bg-emerald-950/30 space-y-2 text-xs">
          <div className="flex flex-wrap items-center gap-2 font-semibold text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>
              Resolved Atomically via {conflict.resolutionOption} by{' '}
              {conflict.resolvedByDisplayName} (
              {conflict.resolvedAt
                ? formatShortTimestamp(conflict.resolvedAt)
                : ''}
              )
            </span>
          </div>
          <p className="text-slate-700 dark:text-slate-300">
            <strong>Rationale:</strong> {conflict.resolutionRationale}
          </p>
          <div className="font-mono text-slate-500 dark:text-slate-400 flex flex-wrap gap-3">
            {conflict.winningClaimId ? (
              <span>Winning Claim: {conflict.winningClaimId} (HUMAN_APPROVED)</span>
            ) : null}
            {conflict.losingClaimId ? (
              <span>Losing Claim: {conflict.losingClaimId} (SUPERSEDED)</span>
            ) : null}
            {synthClaim ? (
              <span>Synthesized Claim: {synthClaim.id} ({synthClaim.title})</span>
            ) : null}
            {conflict.followUpNextActionClaimId ? (
              <span>
                Follow-up Next Action: {conflict.followUpNextActionClaimId}
              </span>
            ) : null}
          </div>
        </div>
      ) : canResolve ? (
        <form
          onSubmit={handleResolve}
          className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 bg-slate-50/40 dark:bg-slate-950/40 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <GitMerge className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Select Atomic Resolution Strategy:</span>
            </span>

            <div className="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-900 rounded-lg">
              {(
                [
                  [
                    ConflictResolutionOption.CLAIM_A,
                    `Approve Claim A (${claimA?.stanceValue || 'A'})`,
                  ],
                  [
                    ConflictResolutionOption.CLAIM_B,
                    `Approve Claim B (${claimB?.stanceValue || 'B'})`,
                  ],
                  [
                    ConflictResolutionOption.SYNTHESIZE,
                    'Synthesize New Decision',
                  ],
                ] as const
              ).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setOption(val)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    option === val
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {option === ConflictResolutionOption.SYNTHESIZE ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Synthesized Claim Title
                </label>
                <input
                  type="text"
                  required
                  value={synthTitle}
                  onChange={(e) => setSynthTitle(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Synthesized Summary
                </label>
                <input
                  type="text"
                  required
                  value={synthSummary}
                  onChange={(e) => setSynthSummary(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                />
              </div>
            </div>
          ) : null}

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Resolution Rationale (Recorded in immutable audit trail)
            </label>
            <textarea
              rows={2}
              required
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={createNotionNextAction}
                onChange={(e) => setCreateNotionNextAction(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>
                Create NEXT_ACTION claim to update outdated Notion documentation
              </span>
            </label>

            <button
              type="submit"
              disabled={isMutating}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              Execute Atomic Conflict Resolution
            </button>
          </div>
        </form>
      ) : (
        <div className="text-xs text-slate-500 dark:text-slate-400">
          Conflict resolution requires Maintainer or Reviewer role outside Shadow Preview.
        </div>
      )}
    </div>
  );
}
