import {
  CanonicalSnapshotPayload,
  Claim,
  ClearanceTier,
  HandoverSnapshot,
} from '../../types';
import { canAccessClearance, filterClaimsByClearance } from '../../security/clearance-policy';
import { canonicalizeJson } from '../../lib/canonical-json';
import { formatClearanceLabel } from '../../lib/utils';

/**
 * Filters a snapshot payload so exports strictly respect the requesting user's effective clearance tier.
 */
export function filterSnapshotForClearance(
  snapshot: HandoverSnapshot,
  effectiveUserTier: ClearanceTier
): HandoverSnapshot {
  const p = snapshot.canonicalPayload;
  const filteredPayload: CanonicalSnapshotPayload = {
    ...p,
    effectiveClearanceTier: Math.min(
      p.effectiveClearanceTier,
      effectiveUserTier
    ) as ClearanceTier,
    activeDecisions: filterClaimsByClearance(p.activeDecisions, effectiveUserTier),
    unfinishedWork: filterClaimsByClearance(p.unfinishedWork, effectiveUserTier),
    risksAndBlockers: filterClaimsByClearance(p.risksAndBlockers, effectiveUserTier),
    dependencies: filterClaimsByClearance(p.dependencies, effectiveUserTier),
    ownershipContacts: filterClaimsByClearance(p.ownershipContacts, effectiveUserTier),
    nextActions: filterClaimsByClearance(p.nextActions, effectiveUserTier),
    contributors: p.contributors.filter((c) =>
      canAccessClearance(effectiveUserTier, c.accessTier)
    ),
    resolvedConflicts: p.resolvedConflicts.filter((c) =>
      canAccessClearance(effectiveUserTier, c.accessTier)
    ),
    supersededClaimsHistory: filterClaimsByClearance(
      p.supersededClaimsHistory,
      effectiveUserTier
    ),
    openKnowledgeGaps: p.openKnowledgeGaps.filter((i) =>
      canAccessClearance(effectiveUserTier, i.accessTier)
    ),
    completedInterviews: p.completedInterviews.filter((i) =>
      canAccessClearance(effectiveUserTier, i.accessTier)
    ),
    firstSevenDaysPlan: p.firstSevenDaysPlan,
  };

  return {
    ...snapshot,
    canonicalPayload: filteredPayload,
  };
}

function renderClaimMarkdownList(claims: Claim[]): string {
  if (claims.length === 0) {
    return '_No records at this clearance level._\n';
  }
  return claims
    .map((c) => {
      const citationsText =
        c.citations.length > 0
          ? c.citations
              .map(
                (cit) =>
                  `  - Citation [${cit.sourceExternalRef || cit.sourceId}] (chars ${cit.charStart}–${cit.charEnd}, ${cit.verificationStatus}): "${cit.verbatimQuote}"`
              )
              .join('\n')
          : '  - Citation: None attached';
      return `- **[${c.verificationStatus}] ${c.title}** (Topic: \`${c.topicKey}\`, Origin: \`${c.extractionOrigin}\`, Tier ${c.accessTier})\n  ${c.summary}\n${citationsText}`;
    })
    .join('\n\n');
}

export function exportSnapshotToMarkdown(
  snapshot: HandoverSnapshot,
  effectiveUserTier: ClearanceTier
): string {
  const filtered = filterSnapshotForClearance(snapshot, effectiveUserTier);
  const p = filtered.canonicalPayload;

  const lines: string[] = [
    `# CHRONICLE HANDOVER PACKAGE: ${p.projectName}`,
    ``,
    `- **Snapshot ID:** \`${filtered.id}\``,
    `- **Version Tag:** \`${filtered.versionTag}\``,
    `- **SHA-256 Integrity Digest:** \`${filtered.sha256Digest}\``,
    `- **Export Clearance Scope:** ${formatClearanceLabel(effectiveUserTier)}`,
    `- **Reconstruction Mode:** \`${p.reconstructionMode}\``,
    `- **Created By:** ${filtered.createdByName} (${filtered.createdAt})`,
    `- **Repository:** ${p.repositoryUrl}`,
    ``,
    `---`,
    ``,
    `## 1. Active Architectural Decisions (${p.activeDecisions.length})`,
    renderClaimMarkdownList(p.activeDecisions),
    ``,
    `## 2. Unfinished Work (${p.unfinishedWork.length})`,
    renderClaimMarkdownList(p.unfinishedWork),
    ``,
    `## 3. Risks and Blockers (${p.risksAndBlockers.length})`,
    renderClaimMarkdownList(p.risksAndBlockers),
    ``,
    `## 4. Critical Dependencies (${p.dependencies.length})`,
    renderClaimMarkdownList(p.dependencies),
    ``,
    `## 5. Contributor Ownership (${p.contributors.length})`,
    p.contributors
      .map(
        (c) =>
          `- **${c.displayName}** (\`@${c.handle}\` · ${c.roleTitle} · ${c.departureStatus}): Modules: ${c.primaryDomains.map((m) => `\`${m}\``).join(', ')}`
      )
      .join('\n') || '_No contributors visible._',
    ``,
    `## 6. Resolved Conflicts (${p.resolvedConflicts.length})`,
    p.resolvedConflicts
      .map(
        (conf) =>
          `- **${conf.title}** (Topic: \`${conf.topicKey}\` · Option: \`${conf.resolutionOption}\`)\n  Rationale: ${conf.resolutionRationale || 'N/A'}`
      )
      .join('\n\n') || '_No resolved conflicts._',
    ``,
    `## 7. Superseded Claims & History (${p.supersededClaimsHistory.length})`,
    renderClaimMarkdownList(p.supersededClaimsHistory),
    ``,
    `## 8. Knowledge Gaps & Exit Interviews`,
    `### Completed Interviews (${p.completedInterviews.length})`,
    p.completedInterviews
      .map(
        (i) =>
          `- **@${i.contributorHandle}** on \`${i.modulePath}\`: **Q:** ${i.question}\n  **A:** ${i.answerTranscript || 'N/A'}`
      )
      .join('\n\n') || '_No completed interviews._',
    ``,
    `### Open Knowledge Gaps (${p.openKnowledgeGaps.length})`,
    p.openKnowledgeGaps
      .map((i) => `- **@${i.contributorHandle}** on \`${i.modulePath}\`: ${i.question}`)
      .join('\n') || '_No open knowledge gaps._',
    ``,
    `## 9. First Seven Days Recommended Actions (${p.firstSevenDaysPlan.length})`,
    p.firstSevenDaysPlan
      .map(
        (act) =>
          `- **[${act.dayRange} · ${act.priority}] ${act.title}** — ${act.rationale}`
      )
      .join('\n') || '_No onboarding actions listed._',
    ``,
    `## 10. Receipt Acknowledgements (${filtered.acknowledgements.length})`,
    filtered.acknowledgements
      .map(
        (ack) =>
          `- **${ack.acknowledgedByName}** (${ack.acknowledgedByRole}) at ${ack.acknowledgedAt} — Verified Digest: \`${ack.verifiedDigest}\` — Notes: "${ack.notes}"`
      )
      .join('\n') || '_Pending incoming owner acknowledgement._',
    ``,
  ];

  return lines.join('\n');
}

export function exportSnapshotToJson(
  snapshot: HandoverSnapshot,
  effectiveUserTier: ClearanceTier
): string {
  const filtered = filterSnapshotForClearance(snapshot, effectiveUserTier);
  return canonicalizeJson(filtered);
}
