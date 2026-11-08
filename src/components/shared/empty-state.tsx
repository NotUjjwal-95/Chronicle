import { ReactNode } from 'react';

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-8 text-center bg-white dark:bg-slate-900">
      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
        {title}
      </h3>
      <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
        {description}
      </p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
