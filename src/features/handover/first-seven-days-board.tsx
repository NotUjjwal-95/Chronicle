'use client';

import { Calendar, CheckCircle2, ChevronRight, User } from 'lucide-react';
import { useProjectWorkspace } from '../../hooks/use-project-workspace';

interface DayAction {
  dayLabel: string;
  title: string;
  category: string;
  description: string;
  primaryContact: string;
}

const DEFAULT_SEVEN_DAYS: DayAction[] = [
  {
    dayLabel: 'DAY 1-2',
    title: 'Workspace Onboarding & Digest Verification',
    category: 'CRITICAL',
    description:
      'Verify SHA-256 snapshot integrity against canonical payload. Review active architectural decisions and security clearance boundary matrix.',
    primaryContact: 'Ujjwal Tyagi (@ujjwal-lead)',
  },
  {
    dayLabel: 'DAY 1-2',
    title: 'Database & Idempotency Key Auditing',
    category: 'CRITICAL',
    description:
      'Inspect ledger settlement table schemas and verify 24-hour composite idempotency index (DEC-002) in PostgreSQL sandbox.',
    primaryContact: 'Elena Rostova (@elena-db)',
  },
  {
    dayLabel: 'DAY 3-5',
    title: 'Stripe Webhook & DLQ Replay Simulation',
    category: 'HIGH',
    description:
      'Test raw webhook payload signature validation (RISK-001) and verify Dead Letter Queue redrive policy in staging environment.',
    primaryContact: 'Marcus Vance (@marcus-incoming)',
  },
  {
    dayLabel: 'DAY 3-5',
    title: 'Reconciliation & Dual-Write Settlement Verification',
    category: 'HIGH',
    description:
      'Audit nightly ledger balance drift checks (DEC-004) and ensure Stripe balance transaction sync matches internal debit records.',
    primaryContact: 'Sora Takahashi (@sora-audit)',
  },
  {
    dayLabel: 'DAY 3-5',
    title: 'Secret Rotation & Vault Boundary Verification',
    category: 'HIGH',
    description:
      'Confirm all connection URIs, Stripe webhook signing keys, and JWT secrets have been rotated post-handover.',
    primaryContact: 'DevOps Security Team (@secops)',
  },
  {
    dayLabel: 'DAY 6-7',
    title: 'Contributor Handover & Knowledge-Gap Review',
    category: 'STANDARD',
    description:
      'Review recorded exit interview transcripts and confirm all open knowledge gap items have explicit mitigation ownership assigned.',
    primaryContact: 'Marcus Vance (@marcus-incoming)',
  },
  {
    dayLabel: 'DAY 6-7',
    title: 'Formal Custody Transfer & Handover Acknowledgement',
    category: 'CRITICAL',
    description:
      'Submit cryptographic receipt acknowledgement in Handover Portal, transitioning primary on-call rotation to incoming service lead.',
    primaryContact: 'Engineering Authority (@ujjwal-lead)',
  },
];

export function FirstSevenDaysBoard() {
  const { snapshots } = useProjectWorkspace();

  // If a snapshot is locked and contains firstSevenDaysPlan, use that
  const latestSnapshot = snapshots[0];
  const actions: DayAction[] =
    latestSnapshot?.canonicalPayload?.firstSevenDaysPlan?.map((a) => ({
      dayLabel: a.dayRange.replace('_', ' '),
      title: a.title,
      category: a.priority,
      description: a.rationale,
      primaryContact: a.ownerHandle || 'Incoming Lead',
    })) || DEFAULT_SEVEN_DAYS;

  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            First 7 Days Operational Handover Playbook
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Structured day-by-day transition checklist automatically synthesized from verified project claims and exit interviews.
          </p>
        </div>
      </div>

      <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {actions.map((item, idx) => (
          <div
            key={`${item.dayLabel}-${idx}`}
            className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/60 flex flex-col justify-between space-y-3"
          >
            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/80 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900">
                  {item.dayLabel}
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  {item.category}
                </span>
              </div>
              <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                {item.title}
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                {item.description}
              </p>
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <User className="w-3 h-3 text-slate-400" />
                {item.primaryContact}
              </span>
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="w-3 h-3" />
                Actionable
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
