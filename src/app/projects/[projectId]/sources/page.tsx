'use client';

import { SourceExplorer } from '../../../../features/ingestion/source-explorer';
import { SourceIngestForm } from '../../../../features/ingestion/source-ingest-form';
import { GithubPrImporter } from '../../../../features/ingestion/github-pr-importer';

export default function SourcesPage() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SourceIngestForm />
        <GithubPrImporter />
      </div>
      <SourceExplorer />
    </div>
  );
}

