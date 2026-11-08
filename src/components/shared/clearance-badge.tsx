import { Shield, Lock, Globe } from 'lucide-react';
import { ClearanceTier } from '../../types';
import { formatClearanceLabel } from '../../lib/utils';

export function ClearanceBadge({ tier }: { tier: ClearanceTier }) {
  // Zero-pill discipline: clean unboxed inline text with semantic icon + label pairing
  if (tier === ClearanceTier.TIER_3_CONFIDENTIAL) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 whitespace-nowrap shrink-0">
        <Lock className="w-3.5 h-3.5 shrink-0" />
        <span>{formatClearanceLabel(tier)}</span>
      </span>
    );
  }

  if (tier === ClearanceTier.TIER_2_INTERNAL) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 whitespace-nowrap shrink-0">
        <Shield className="w-3.5 h-3.5 shrink-0" />
        <span>{formatClearanceLabel(tier)}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 whitespace-nowrap shrink-0">
      <Globe className="w-3.5 h-3.5 shrink-0" />
      <span>{formatClearanceLabel(tier)}</span>
    </span>
  );
}
