import { ClearanceTier, ClaimCategory, ClaimVerificationStatus, SourceType } from '../types';

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export function formatClearanceLabel(tier: ClearanceTier): string {
  switch (tier) {
    case ClearanceTier.TIER_1_EXTERNAL:
      return 'Tier 1 · External';
    case ClearanceTier.TIER_2_INTERNAL:
      return 'Tier 2 · Internal';
    case ClearanceTier.TIER_3_CONFIDENTIAL:
      return 'Tier 3 · Confidential';
    default:
      return `Tier ${tier}`;
  }
}

export function formatSourceTypeLabel(type: SourceType): string {
  switch (type) {
    case SourceType.GITHUB_PR:
      return 'GitHub PR';
    case SourceType.SLACK_THREAD:
      return 'Slack Thread';
    case SourceType.JIRA_TICKET:
      return 'Jira Ticket';
    case SourceType.NOTION_DOC:
      return 'Notion Doc';
    case SourceType.CUSTOM_NOTE:
      return 'Custom Note';
  }
}

export function formatClaimCategoryLabel(category: ClaimCategory): string {
  switch (category) {
    case ClaimCategory.DECISION:
      return 'Architectural Decision';
    case ClaimCategory.UNFINISHED_WORK:
      return 'Unfinished Work';
    case ClaimCategory.RISK_BLOCKER:
      return 'Risk & Blocker';
    case ClaimCategory.DEPENDENCY:
      return 'Dependency';
    case ClaimCategory.OWNERSHIP_CONTACT:
      return 'Ownership & Contact';
    case ClaimCategory.NEXT_ACTION:
      return 'Recommended Next Action';
  }
}

export function formatVerificationStatusLabel(status: ClaimVerificationStatus): string {
  switch (status) {
    case ClaimVerificationStatus.EXTRACTED:
      return 'Extracted';
    case ClaimVerificationStatus.VERIFIED:
      return 'Grounded & Verified';
    case ClaimVerificationStatus.MISSING_EVIDENCE:
      return 'Missing Evidence';
    case ClaimVerificationStatus.CONFLICTED:
      return 'Conflicted';
    case ClaimVerificationStatus.HUMAN_APPROVED:
      return 'Human Approved';
    case ClaimVerificationStatus.SUPERSEDED:
      return 'Superseded';
    case ClaimVerificationStatus.REJECTED:
      return 'Rejected';
  }
}

export function formatShortTimestamp(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  } catch {
    return isoString;
  }
}
