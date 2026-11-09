'use client';

import { useState, FormEvent } from 'react';
import { Lock, Plus, ShieldCheck } from 'lucide-react';
import { ProjectRole } from '../../types';
import { useProjectWorkspace } from '../../hooks/use-project-workspace';
import { SnapshotIntegrityCard } from './snapshot-integrity-card';
import { FirstSevenDaysBoard } from './first-seven-days-board';
import { AuditTrailTable } from './audit-trail-table';
import { EmptyState } from '../../components/shared/empty-state';

export function HandoverPortal() {
  const { snapshots, session, isMutating, createSnapshot } =
    useProjectWorkspace();

  const [versionTag, setVersionTag] = useState('v1.0.0-final');
  const [showCreateForm, setShowCreateForm] = useState(false);

  const canCreateSnapshot =
    session &&
    !session.isShadowPreview &&
    (session.role === ProjectRole.MAINTAINER ||
      session.role === ProjectRole.REVIEWER);

  const handleCreateSnapshot = async (e: FormEvent) => {
    e.preventDefault();
    if (!versionTag.trim()) return;
    const snap = await createSnapshot(versionTag.trim());
    if (snap) {
      setShowCreateForm(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Handover Overview and Snapshot Creation Banner */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-5 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Handover Intelligence & Cryptographic Custody Portal
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
            Package verified decisions, dependencies, exit interviews, and recommended next actions into an immutable, SHA-256 verifiable snapshot.
          </p>
        </div>

        {canCreateSnapshot ? (
          <button
            type="button"
            disabled={isMutating}
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="px-3.5 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Lock className="w-3.5 h-3.5" />
            Lock New Handover Snapshot
          </button>
        ) : null}
      </div>

      {showCreateForm ? (
        <form
          onSubmit={handleCreateSnapshot}
          className="border border-blue-200 dark:border-blue-900 rounded-lg p-4 bg-blue-50/50 dark:bg-blue-950/30 space-y-3"
        >
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Snapshot Version Tag:
                <input
                  type="text"
                  required
                  pattern="^[a-zA-Z0-9._-]+$"
                  value={versionTag}
                  onChange={(e) => setVersionTag(e.target.value)}
                  placeholder="e.g. v1.0.0-final"
                  className="mt-1 block w-full px-3 py-1.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-mono"
                />
              </label>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isMutating}
                className="px-4 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-500 transition-colors whitespace-nowrap"
              >
                Compute Hash & Lock
              </button>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Locking an immutable snapshot serializes all currently visible decisions, claims, conflicts, and interviews with canonical key sorting and generates a deterministic SHA-256 digest.
          </p>
        </form>
      ) : null}

      {/* Snapshots List */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Locked Handover Snapshots ({snapshots.length})
        </h3>
        {snapshots.length === 0 ? (
          <EmptyState
            title="No Locked Snapshots Yet"
            description="Create your first immutable handover snapshot to generate a verifiable digest and enable incoming service owner acceptance."
          />
        ) : (
          <div className="space-y-4">
            {snapshots.map((snap) => (
              <SnapshotIntegrityCard key={snap.id} snapshot={snap} />
            ))}
          </div>
        )}
      </div>

      {/* First 7 Days Operational Playbook */}
      <FirstSevenDaysBoard />

      {/* Append-only Cryptographic Audit Trail */}
      <AuditTrailTable />
    </div>
  );
}

