'use client';

import { Shield, Clock, User, Tag } from 'lucide-react';
import { useProjectWorkspace } from '../../hooks/use-project-workspace';
import { ClearanceBadge } from '../../components/shared/clearance-badge';
import { formatShortTimestamp } from '../../lib/utils';
import { EmptyState } from '../../components/shared/empty-state';

export function AuditTrailTable() {
  const { auditLogs } = useProjectWorkspace();

  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            Cryptographic Audit Trail
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Strict append-only record of all session switches, secret redactions, reconstructions, conflict resolutions, and snapshots.
          </p>
        </div>
        <span className="text-xs font-mono text-slate-400">
          {auditLogs.length} logged events
        </span>
      </div>

      {auditLogs.length === 0 ? (
        <div className="p-6">
          <EmptyState
            title="No Audit Records"
            description="Audit events will appear as actions are performed in the workspace."
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400">
                <th className="py-2.5 px-4 font-medium font-mono">Seq #</th>
                <th className="py-2.5 px-4 font-medium">Timestamp</th>
                <th className="py-2.5 px-4 font-medium">Actor</th>
                <th className="py-2.5 px-4 font-medium">Action</th>
                <th className="py-2.5 px-4 font-medium">Target Entity</th>
                <th className="py-2.5 px-4 font-medium">Clearance</th>
                <th className="py-2.5 px-4 font-medium">Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {auditLogs.map((log) => (
                <tr
                  key={log.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-950/40 transition-colors"
                >
                  <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">
                    #{log.sequenceNumber}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {formatShortTimestamp(log.createdAt)}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      {log.actorDisplayName}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {log.actorRole}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                      {log.action}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                    {log.targetEntityType} · {log.targetEntityId}
                  </td>
                  <td className="py-3 px-4">
                    <ClearanceBadge tier={log.accessTier} />
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-500 dark:text-slate-400 max-w-xs truncate">
                    {JSON.stringify(log.metadata)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

