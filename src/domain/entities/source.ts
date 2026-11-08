import { ClearanceTier, RedactionRecord, SourceType } from '../../types';

export interface SourceArtifact {
  id: string;
  organizationId: string;
  projectId: string;
  sourceType: SourceType;
  externalRef: string;
  title: string;
  authorHandle: string;
  createdAt: string;
  accessTier: ClearanceTier;
  sanitizedContent: string;
  redactionMetadata: RedactionRecord[];
  redactedCount: number;
  modulePaths: string[];
}

export interface SanitizedSource {
  id: string;
  sourceType: SourceType;
  externalRef: string;
  title: string;
  authorHandle: string;
  createdAt: string;
  accessTier: ClearanceTier;
  sanitizedContent: string;
  modulePaths: string[];
}
