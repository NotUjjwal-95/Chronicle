'use client';

import { useState } from 'react';
import { Check, X } from 'lucide-react';
import {
  ClaimCategory,
  ClaimVerificationStatus,
  ProjectRole,
  canTransitionClaimStatus,
} from '../../types';
import { useProjectWorkspace } from '../../hooks/use-project-workspace';
import { ClaimStatusBadge } from '../../components/shared/claim-status-badge';
import { ClearanceBadge } from '../../components/shared/clearance-badge';
import { CitationChip } from '../../components/shared/citation-chip';
import { EmptyState } from '../../components/shared/empty-state';
import {
  formatClaimCategoryLabel,
  formatShortTimestamp,
} from '../../lib/utils';

export function TimelineView() {
  const {
    claims,
    session,
    isMutating,
    openEvidenceDrawer,
    updateClaimStatus,
  } = useProjectWorkspace();

  const [selectedCategory, setSelectedCategory] = useState<
    'ALL' | ClaimCategory
  >('ALL');
  const [selectedStatus, setSelectedStatus] = useState<
    'ALL' | ClaimVerificationStatus
  >('ALL');

  const canReview =
    session &&
    !session.isShadowPreview &&
    (session.role === ProjectRole.MAINTAINER ||
      session.role === ProjectRole.REVIEWER);

  const filtered = claims.filter((c) => {
    if (selectedCategory !== 'ALL' && c.category !== selectedCategory) {
      return false;
    }
    if (selectedStatus !== 'ALL' && c.verificationStatus !== selectedStatus) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Category & Verification Status Filter Bar */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 bg-white dark:bg-slate-900 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-lg">
          {(
            [
              ['ALL', 'All Categories'],
              [ClaimCategory.DECISION, 'Decisions'],
              [ClaimCategory.UNFINISHED_WORK, 'Unfinished Work'],
              [ClaimCategory.RISK_BLOCKER, 'Risks & Blockers'],
              [ClaimCategory.DEPENDENCY, 'Dependencies'],
              [ClaimCategory.OWNERSHIP_CONTACT, 'Ownership'],
              [ClaimCategory.NEXT_ACTION, 'Next Actions'],
            ] as const
          ).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setSelectedCategory(val)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                selectedCategory === val
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Status:
          </span>
          <select
            value={selectedStatus}
            onChange={(e) =>
              setSelectedStatus(
                e.target.value as 'ALL' | ClaimVerificationStatus
              )
            }
            className="px-3 py-1.5 text-xs rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
          >
            <option value="ALL">All States ({claims.length})</option>
            <option value={ClaimVerificationStatus.VERIFIED}>Verified</option>
            <option value={ClaimVerificationStatus.HUMAN_APPROVED}>
              Human Approved
            </option>
            <option value={ClaimVerificationStatus.CONFLICTED}>
              Conflicted
            </option>
            <option value={ClaimVerificationStatus.MISSING_EVIDENCE}>
              Missing Evidence
            </option>
            <option value={ClaimVerificationStatus.SUPERSEDED}>
              Superseded (Historical)
            </option>
            <option value={ClaimVerificationStatus.REJECTED}>Rejected</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No Claims Match Current Filters"
          description="Select another category or verification status to inspect reconstructed claims."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((claim) => {
            const canApprove = canTransitionClaimStatus(
              claim.verificationStatus,
              ClaimVerificationStatus.HUMAN_APPROVED,
              'HUMAN'
            );
            const canReject = canTransitionClaimStatus(
              claim.verificationStatus,
              ClaimVerificationStatus.REJECTED,
              'HUMAN'
            );

            return (
              <div
                key={claim.id}
                className="border border-slate-200 dark:border-slate-800 rounded-lg p-5 bg-white dark:bg-slate-900 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <ClaimStatusBadge status={claim.verificationStatus} />
                    <span aria-hidden="true">·</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {formatClaimCategoryLabel(claim.category)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono">Topic: {claim.topicKey}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono">Stance: {claim.stanceValue}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      Origin: {claim.extractionOrigin}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {formatShortTimestamp(claim.createdAt)}
                    </span>
                  </div>

                  <ClearanceBadge tier={claim.accessTier} />
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {claim.title}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {claim.summary}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Grounded Citations:
                    </span>
                    {claim.citations.map((cit, idx) => (
                      <CitationChip
                        key={cit.id}
                        citation={cit}
                        onClick={() => openEvidenceDrawer(claim, idx)}
                      />
                    ))}
                    {claim.modulePaths.length > 0 ? (
                      <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                        · Modules: {claim.modulePaths.join(', ')}
                      </span>
                    ) : null}
                  </div>

                  {canReview ? (
                    <div className="flex items-center gap-2">
                      {canApprove &&
                      claim.verificationStatus !==
                        ClaimVerificationStatus.HUMAN_APPROVED ? (
                        <button
                          type="button"
                          disabled={isMutating}
                          onClick={() =>
                            updateClaimStatus(
                              claim.id,
                              ClaimVerificationStatus.HUMAN_APPROVED,
                              'Approved during timeline review.'
                            )
                          }
                          className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-md border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 transition-colors whitespace-nowrap shrink-0"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Human Approve</span>
                        </button>
                      ) : null}

                      {canReject &&
                      claim.verificationStatus !==
                        ClaimVerificationStatus.REJECTED ? (
                        <button
                          type="button"
                          disabled={isMutating}
                          onClick={() =>
                            updateClaimStatus(
                              claim.id,
                              ClaimVerificationStatus.REJECTED,
                              'Rejected during timeline review.'
                            )
                          }
                          className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-rose-600 transition-colors whitespace-nowrap shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
