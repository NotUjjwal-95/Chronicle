'use client';

import { Check, X } from 'lucide-react';
import {
  ClaimVerificationStatus,
  ProjectRole,
  canTransitionClaimStatus,
} from '../../types';
import { useProjectWorkspace } from '../../hooks/use-project-workspace';
import { ClaimStatusBadge } from '../../components/shared/claim-status-badge';
import { ClearanceBadge } from '../../components/shared/clearance-badge';
import { CitationChip } from '../../components/shared/citation-chip';
import { formatClaimCategoryLabel } from '../../lib/utils';

export function VerificationMatrix() {
  const {
    claims,
    session,
    isMutating,
    openEvidenceDrawer,
    updateClaimStatus,
    verifyAllCitations,
  } = useProjectWorkspace();

  const canReviewClaims =
    session &&
    !session.isShadowPreview &&
    (session.role === ProjectRole.MAINTAINER ||
      session.role === ProjectRole.REVIEWER);

  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Citation Grounding & Evidence Verification Matrix
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Every claim citation is checked against exact sanitized source character offsets. Human approvals cannot be overwritten by automated runs.
          </p>
        </div>

        {!session?.isShadowPreview ? (
          <button
            type="button"
            disabled={isMutating}
            onClick={verifyAllCitations}
            className="px-3.5 py-2 text-xs font-medium rounded-lg bg-slate-900 text-white dark:bg-blue-600 hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
          >
            Run CitationGrounder Verification
          </button>
        ) : null}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400">
              <th className="py-3 px-4 font-medium">Claim & Category</th>
              <th className="py-3 px-4 font-medium">Topic / Stance</th>
              <th className="py-3 px-4 font-medium">Citation Coordinates</th>
              <th className="py-3 px-4 font-medium">Status</th>
              <th className="py-3 px-4 font-medium">Clearance</th>
              <th className="py-3 px-4 font-medium text-right">Human Review</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {claims.slice(0, 14).map((claim) => {
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
                <tr
                  key={claim.id}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <td className="py-3 px-4 max-w-xs">
                    <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {claim.title}
                    </div>
                    <div className="text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
                      <span>{formatClaimCategoryLabel(claim.category)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">{claim.extractionOrigin}</span>
                    </div>
                  </td>

                  <td className="py-3 px-4 font-mono tabular-nums text-slate-600 dark:text-slate-300">
                    <div>{claim.topicKey}</div>
                    <div className="text-slate-400 text-[11px]">
                      {claim.stanceValue}
                    </div>
                  </td>

                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1.5">
                      {claim.citations.map((cit, idx) => (
                        <CitationChip
                          key={cit.id}
                          citation={cit}
                          onClick={() => openEvidenceDrawer(claim, idx)}
                        />
                      ))}
                    </div>
                  </td>

                  <td className="py-3 px-4">
                    <ClaimStatusBadge status={claim.verificationStatus} />
                  </td>

                  <td className="py-3 px-4">
                    <ClearanceBadge tier={claim.accessTier} />
                  </td>

                  <td className="py-3 px-4 text-right">
                    {canReviewClaims ? (
                      <div className="inline-flex items-center gap-1.5">
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
                                'Explicit human reviewer verification of citation offsets.'
                              )
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 transition-colors whitespace-nowrap shrink-0"
                          >
                            <Check className="w-3 h-3" />
                            <span>Approve</span>
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
                                'Rejected during human handover review.'
                              )
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:text-rose-600 transition-colors whitespace-nowrap shrink-0"
                          >
                            <X className="w-3 h-3" />
                            <span>Reject</span>
                          </button>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-slate-400">Read-only</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
