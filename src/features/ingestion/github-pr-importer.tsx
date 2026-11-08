import { useState, FormEvent } from 'react';
import { ClearanceTier } from '../../types';
import { useProjectWorkspace } from '../../hooks/use-project-workspace';

export function GithubPrImporter() {
  const { session, isMutating, importGithubPr, runReconstruction } =
    useProjectWorkspace();

  const [owner, setOwner] = useState('chronicle-fin');
  const [repo, setRepo] = useState('core-payments-service');
  const [pullNumber, setPullNumber] = useState(482);
  const [accessTier, setAccessTier] = useState<ClearanceTier>(
    ClearanceTier.TIER_2_INTERNAL
  );

  const canImport = session && !session.isShadowPreview;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canImport) return;
    const created = await importGithubPr({
      owner,
      repo,
      pullNumber: Number(pullNumber),
      accessTier,
    });
    if (created) {
      await runReconstruction({ useAiEnrichment: false });
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="border border-slate-200 dark:border-slate-800 rounded-lg p-5 bg-white dark:bg-slate-900 space-y-4"
    >
      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Import GitHub Pull Request Artifact
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Imports PR metadata and body, executes SecretRedactor, and extracts deterministic candidate claims.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
            Repository Owner
          </label>
          <input
            type="text"
            required
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            className="w-full px-3 py-1.5 text-xs font-mono rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
            Repository Name
          </label>
          <input
            type="text"
            required
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            className="w-full px-3 py-1.5 text-xs font-mono rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
            Pull Request Number
          </label>
          <input
            type="number"
            min={1}
            required
            value={pullNumber}
            onChange={(e) => setPullNumber(Number(e.target.value))}
            className="w-full px-3 py-1.5 text-xs font-mono tabular-nums rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
            Clearance Tier
          </label>
          <select
            value={accessTier}
            onChange={(e) =>
              setAccessTier(Number(e.target.value) as ClearanceTier)
            }
            className="w-full px-3 py-1.5 text-xs rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
          >
            <option value={ClearanceTier.TIER_1_EXTERNAL}>
              Tier 1 · External
            </option>
            <option value={ClearanceTier.TIER_2_INTERNAL}>
              Tier 2 · Internal
            </option>
            <option value={ClearanceTier.TIER_3_CONFIDENTIAL}>
              Tier 3 · Confidential
            </option>
          </select>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={!canImport || isMutating}
          className="px-4 py-2 text-xs font-medium rounded-lg bg-slate-900 text-white dark:bg-slate-800 hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap shrink-0"
        >
          Import PR #{pullNumber}
        </button>
      </div>
    </form>
  );
}
