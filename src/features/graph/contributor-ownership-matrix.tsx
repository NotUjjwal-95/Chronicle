import { useProjectWorkspace } from '../../hooks/use-project-workspace';
import { ClearanceBadge } from '../../components/shared/clearance-badge';

export function ContributorOwnershipMatrix() {
  const { contributors } = useProjectWorkspace();

  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Contributor Ownership & Departure Blast-Radius Matrix
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Maps engineering contributors to primary domain modules and handover status.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400">
              <th className="py-3 px-4 font-medium">Contributor</th>
              <th className="py-3 px-4 font-medium">Role Title</th>
              <th className="py-3 px-4 font-medium">Handover Status</th>
              <th className="py-3 px-4 font-medium">Owned Modules</th>
              <th className="py-3 px-4 font-medium">Clearance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {contributors.map((c) => (
              <tr
                key={c.id}
                className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
              >
                <td className="py-3 px-4">
                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                    {c.displayName}
                  </div>
                  <div className="font-mono text-slate-500 dark:text-slate-400">
                    @{c.handle} · {c.email}
                  </div>
                </td>
                <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                  {c.roleTitle}
                </td>
                <td className="py-3 px-4 font-mono">
                  <span
                    className={
                      c.departureStatus === 'DEPARTING'
                        ? 'text-rose-600 dark:text-rose-400 font-semibold'
                        : c.departureStatus === 'INCOMING'
                        ? 'text-blue-600 dark:text-blue-400 font-semibold'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }
                  >
                    {c.departureStatus}
                  </span>
                </td>
                <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">
                  {c.primaryDomains.join(', ')}
                </td>
                <td className="py-3 px-4">
                  <ClearanceBadge tier={c.accessTier} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
