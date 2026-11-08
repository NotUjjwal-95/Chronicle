import { useState, FormEvent } from 'react';
import { ClearanceTier, SourceType } from '../../types';
import { useProjectWorkspace } from '../../hooks/use-project-workspace';

export function SourceIngestForm() {
  const { session, isMutating, ingestSource, runReconstruction } =
    useProjectWorkspace();

  const [sourceType, setSourceType] = useState<SourceType>(
    SourceType.CUSTOM_NOTE
  );
  const [externalRef, setExternalRef] = useState('NOTE-HANDOVER-05');
  const [title, setTitle] = useState(
    'Post-Freeze Settlement Outbox Vacuum & Planted Credential Audit'
  );
  const [authorHandle, setAuthorHandle] = useState('arjun-mehta');
  const [accessTier, setAccessTier] = useState<ClearanceTier>(
    ClearanceTier.TIER_2_INTERNAL
  );
  const [modulePathInput, setModulePathInput] = useState(
    'src/ledger/outbox.ts, src/workers/retry.ts'
  );
  const [rawContent, setRawContent] = useState(
    'We decided to enforce autovacuum_vacuum_scale_factor=0.01 on src/ledger/outbox.ts to prevent transaction ID wraparound during settlement spikes. TODO: Remove temporary debug key sk_live_FAKE_PLANTED_INGEST_TEST_112233445566 and postgres://admin:FakeSecret999@10.0.14.8:5432/outbox before final handover.'
  );

  const canIngest = session && !session.isShadowPreview;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canIngest) return;

    const modulePaths = modulePathInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const created = await ingestSource({
      sourceType,
      externalRef,
      title,
      authorHandle,
      accessTier,
      rawContent,
      modulePaths,
    });

    if (created) {
      // Automatically run deterministic extraction on the newly ingested source
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
          Ingest Custom Engineering Artifact
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          SecretRedactor scrubs credentials prior to persistence, and DeterministicExtractor immediately grounds candidate facts.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
            Source Type
          </label>
          <select
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value as SourceType)}
            className="w-full px-3 py-1.5 text-xs rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
          >
            <option value={SourceType.CUSTOM_NOTE}>Custom Note</option>
            <option value={SourceType.GITHUB_PR}>GitHub PR</option>
            <option value={SourceType.SLACK_THREAD}>Slack Thread</option>
            <option value={SourceType.JIRA_TICKET}>Jira Ticket</option>
            <option value={SourceType.NOTION_DOC}>Notion Doc</option>
          </select>
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

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
            External Reference ID
          </label>
          <input
            type="text"
            required
            value={externalRef}
            onChange={(e) => setExternalRef(e.target.value)}
            className="w-full px-3 py-1.5 text-xs font-mono rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
            Author Handle
          </label>
          <input
            type="text"
            required
            value={authorHandle}
            onChange={(e) => setAuthorHandle(e.target.value)}
            className="w-full px-3 py-1.5 text-xs font-mono rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
          Artifact Title
        </label>
        <input
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-3 py-1.5 text-xs rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
          Referenced Module Paths (comma-separated)
        </label>
        <input
          type="text"
          value={modulePathInput}
          onChange={(e) => setModulePathInput(e.target.value)}
          className="w-full px-3 py-1.5 text-xs font-mono rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
          Raw Artifact Content (Planted synthetic secrets will be automatically redacted)
        </label>
        <textarea
          rows={4}
          required
          value={rawContent}
          onChange={(e) => setRawContent(e.target.value)}
          className="w-full px-3 py-2 text-xs font-mono rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
        />
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={!canIngest || isMutating}
          className="px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
        >
          {isMutating
            ? 'Redacting & Ingesting...'
            : 'Sanitize, Ingest & Extract Claims'}
        </button>
      </div>
    </form>
  );
}
