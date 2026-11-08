import {
  CheckCircle2,
  ShieldCheck,
  AlertTriangle,
  FileWarning,
  Clock,
  Archive,
  XCircle,
} from 'lucide-react';
import { ClaimVerificationStatus } from '../../types';
import { formatVerificationStatusLabel } from '../../lib/utils';

export function ClaimStatusBadge({
  status,
}: {
  status: ClaimVerificationStatus;
}) {
  // Zero-pill discipline: unboxed text paired with explicit semantic icon for color-blind accessibility
  switch (status) {
    case ClaimVerificationStatus.HUMAN_APPROVED:
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap shrink-0">
          <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
          <span>{formatVerificationStatusLabel(status)}</span>
        </span>
      );
    case ClaimVerificationStatus.VERIFIED:
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 whitespace-nowrap shrink-0">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>{formatVerificationStatusLabel(status)}</span>
        </span>
      );
    case ClaimVerificationStatus.CONFLICTED:
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 whitespace-nowrap shrink-0">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>{formatVerificationStatusLabel(status)}</span>
        </span>
      );
    case ClaimVerificationStatus.MISSING_EVIDENCE:
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 whitespace-nowrap shrink-0">
          <FileWarning className="w-3.5 h-3.5 shrink-0" />
          <span>{formatVerificationStatusLabel(status)}</span>
        </span>
      );
    case ClaimVerificationStatus.SUPERSEDED:
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">
          <Archive className="w-3.5 h-3.5 shrink-0" />
          <span>{formatVerificationStatusLabel(status)}</span>
        </span>
      );
    case ClaimVerificationStatus.REJECTED:
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">
          <XCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{formatVerificationStatusLabel(status)}</span>
        </span>
      );
    case ClaimVerificationStatus.EXTRACTED:
    default:
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap shrink-0">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>{formatVerificationStatusLabel(status)}</span>
        </span>
      );
  }
}
