'use client';

import { useState } from 'react';
import { ShieldCheck, Download, CheckCircle2, AlertCircle, FileText, Lock } from 'lucide-react';
import { HandoverSnapshot, ProjectRole } from '../../types';
import { useProjectWorkspace } from '../../hooks/use-project-workspace';
import { ClearanceBadge } from '../../components/shared/clearance-badge';
import { formatShortTimestamp } from '../../lib/utils';
import { SnapshotVerificationReport } from '../../domain/engines/snapshot-hasher';

export function SnapshotIntegrityCard({ snapshot }: { snapshot: HandoverSnapshot }) {
  const {
    session,
    isMutating,
    verifySnapshotDigest,
    acknowledgeSnapshotReceipt,
    exportSnapshotPackage,
  } = useProjectWorkspace();

  const [verificationReport, setVerificationReport] =
    useState<SnapshotVerificationReport | null>(null);
  const [showAckForm, setShowAckForm] = useState(false);
  const [ackNotes, setAckNotes] = useState(
    'Reviewed architecture decisions, risks, dependencies, and SHA-256 digest. Ready for handover.'
  );

  const canAcknowledge =
    session &&
    !session.isShadowPreview &&
    (session.role === ProjectRole.INCOMING_OWNER ||
      session.role === ProjectRole.MAINTAINER ||
      session.role === ProjectRole.REVIEWER);

  const handleVerify = async () => {
    const report = await verifySnapshotDigest(snapshot.id);
    if (report) {
      setVerificationReport(report);
    }
  };

  const handleExport = async (format: 'markdown' | 'json') => {
    const exported = await exportSnapshotPackage(snapshot.id, format);
    if (exported) {
      const blob = new Blob([exported.content], {
        type: format === 'json' ? 'application/json' : 'text/markdown',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = exported.filename;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleAcknowledge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ackNotes.trim()) return;
    await acknowledgeSnapshotReceipt(
      snapshot.id,
      ackNotes.trim(),
      snapshot.sha256Digest
    );
    setShowAckForm(false);
  };

  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-5 bg-white dark:bg-slate-900 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-mono font-medium bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
              <Lock className="w-3 h-3" />
              {snapshot.versionTag}
            </span>
            <ClearanceBadge tier={snapshot.accessTier} />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
            Locked by <strong>{snapshot.createdByName}</strong> on{' '}
            {formatShortTimestamp(snapshot.createdAt)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isMutating}
            onClick={() => handleExport('markdown')}
            className="px-3 py-1.5 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            Export Markdown
          </button>
          <button
            type="button"
            disabled={isMutating}
            onClick={() => handleExport('json')}
            className="px-3 py-1.5 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <FileText className="w-3.5 h-3.5" />
            Export JSON
          </button>
        </div>
      </div>

      <div className="p-3 bg-slate-50 dark:bg-slate-950/80 rounded-md border border-slate-200 dark:border-slate-800 font-mono text-xs break-all">
        <div className="text-[11px] uppercase tracking-wider text-slate-400 mb-1">
          Cryptographic SHA-256 Digest
        </div>
        <div className="text-blue-600 dark:text-blue-400 font-semibold selection:bg-blue-600 selection:text-white">
          {snapshot.sha256Digest}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <button
          type="button"
          disabled={isMutating}
          onClick={handleVerify}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-slate-900 text-white dark:bg-blue-600 hover:opacity-90 transition-opacity flex items-center gap-1.5 whitespace-nowrap shrink-0"
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          Verify SHA-256 Integrity
        </button>

        {canAcknowledge && !showAckForm ? (
          <button
            type="button"
            onClick={() => setShowAckForm(true)}
            className="px-3 py-1.5 text-xs font-medium rounded-md border border-emerald-600 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Acknowledge Receipt
          </button>
        ) : null}
      </div>

      {verificationReport ? (
        <div
          className={`p-3 rounded-md text-xs border ${
            verificationReport.isIntegrityValid
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2 font-medium">
            {verificationReport.isIntegrityValid ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span>
              {verificationReport.isIntegrityValid
                ? 'Integrity Verified: Canonical JSON hash strictly matches authoritative SHA-256 digest.'
                : 'Integrity Failure: Canonical digest mismatch! Handover payload was modified.'}
            </span>
          </div>
          <div className="mt-1 font-mono text-[11px] opacity-80 break-all">
            Computed: {verificationReport.recomputedDigest}
          </div>
        </div>
      ) : null}

      {showAckForm ? (
        <form
          onSubmit={handleAcknowledge}
          className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-3"
        >
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
            Incoming Service Owner Handover Acceptance Notes:
            <textarea
              required
              rows={2}
              value={ackNotes}
              onChange={(e) => setAckNotes(e.target.value)}
              className="mt-1 block w-full px-3 py-2 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            />
          </label>
          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={() => setShowAckForm(false)}
              className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isMutating}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
            >
              Submit Cryptographic Acknowledgement
            </button>
          </div>
        </form>
      ) : null}

      {snapshot.acknowledgements && snapshot.acknowledgements.length > 0 ? (
        <div className="border-t border-slate-200 dark:border-slate-800 pt-3 space-y-2">
          <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
            Recorded Receipt Acknowledgements:
          </div>
          {snapshot.acknowledgements.map((ack) => (
            <div
              key={ack.id}
              className="p-2.5 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-1"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {ack.acknowledgedByName} ({ack.acknowledgedByRole})
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  {formatShortTimestamp(ack.acknowledgedAt)}
                </span>
              </div>
              <p className="text-slate-600 dark:text-slate-400">{ack.notes}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

