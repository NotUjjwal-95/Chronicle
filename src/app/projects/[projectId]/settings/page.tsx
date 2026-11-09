'use client';

import { useState, FormEvent, useEffect } from 'react';
import { Settings, RotateCcw, Save, ShieldAlert } from 'lucide-react';
import { ProjectRole } from '../../../../types';
import { useProjectWorkspace } from '../../../../hooks/use-project-workspace';

export default function SettingsPage() {
  const {
    project,
    session,
    isMutating,
    updateProjectMetadata,
    resetWorkspaceToSeed,
    persistenceMode,
  } = useProjectWorkspace();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [departingLeadHandle, setDepartingLeadHandle] = useState('');
  const [incomingLeadHandle, setIncomingLeadHandle] = useState('');

  useEffect(() => {
    if (project) {
      setName(project.name);
      setDescription(project.description);
      setDepartingLeadHandle(project.departingLeadHandle);
      setIncomingLeadHandle(project.incomingLeadHandle);
    }
  }, [project]);

  const canEdit =
    session &&
    !session.isShadowPreview &&
    session.role === ProjectRole.MAINTAINER;

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    await updateProjectMetadata({
      name,
      description,
      departingLeadHandle,
      incomingLeadHandle,
    });
  };

  const handleReset = async () => {
    if (
      window.confirm(
        'Reset demonstration workspace to the deterministic 28-artifact Core-Payments-Service baseline?'
      )
    ) {
      await resetWorkspaceToSeed();
    }
  };

  if (!project) {
    return null;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-5 bg-white dark:bg-slate-900">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Settings className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          Project Governance & Workspace Configuration
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Configure project ownership, repository parameters, and demonstration workspace state.
        </p>
      </div>

      <form
        onSubmit={handleSave}
        className="border border-slate-200 dark:border-slate-800 rounded-lg p-6 bg-white dark:bg-slate-900 space-y-4"
      >
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Governance Metadata
        </h3>

        <div className="space-y-3 text-xs">
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300">
              Project Name:
              <input
                type="text"
                disabled={!canEdit || isMutating}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 disabled:opacity-60"
              />
            </label>
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300">
              Project Description:
              <textarea
                rows={3}
                disabled={!canEdit || isMutating}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 block w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 disabled:opacity-60"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300">
                Departing Service Lead Handle:
                <input
                  type="text"
                  disabled={!canEdit || isMutating}
                  value={departingLeadHandle}
                  onChange={(e) => setDepartingLeadHandle(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-mono disabled:opacity-60"
                />
              </label>
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300">
                Incoming Service Lead Handle:
                <input
                  type="text"
                  disabled={!canEdit || isMutating}
                  value={incomingLeadHandle}
                  onChange={(e) => setIncomingLeadHandle(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-mono disabled:opacity-60"
                />
              </label>
            </div>
          </div>
        </div>

        {canEdit ? (
          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={isMutating}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              Save Governance Settings
            </button>
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">
            Editing settings requires the Maintainer role.
          </p>
        )}
      </form>

      {persistenceMode === 'seed' ? (
        <div className="border border-rose-200 dark:border-rose-900/60 rounded-lg p-5 bg-rose-50/40 dark:bg-rose-950/20 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
            <h3 className="text-sm font-semibold text-rose-900 dark:text-rose-200">
              Reset Demonstration Workspace
            </h3>
          </div>
          <p className="text-xs text-rose-800 dark:text-rose-300 leading-relaxed">
            Restores all 28 sources, deterministic citations, and canonical conflicts back to the initial Core-Payments-Service dataset state. Any human edits, approved claims, and locked snapshots will be reset.
          </p>
          <div className="pt-1">
            <button
              type="button"
              disabled={isMutating || session?.isShadowPreview}
              onClick={handleReset}
              className="px-3.5 py-2 text-xs font-medium rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Demonstration Baseline
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

