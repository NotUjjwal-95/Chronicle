export enum ClearanceTier {
  TIER_1_EXTERNAL = 1,
  TIER_2_INTERNAL = 2,
  TIER_3_CONFIDENTIAL = 3,
}

export enum SourceType {
  GITHUB_PR = 'GITHUB_PR',
  SLACK_THREAD = 'SLACK_THREAD',
  JIRA_TICKET = 'JIRA_TICKET',
  NOTION_DOC = 'NOTION_DOC',
  CUSTOM_NOTE = 'CUSTOM_NOTE',
}

export enum ClaimCategory {
  DECISION = 'DECISION',
  UNFINISHED_WORK = 'UNFINISHED_WORK',
  RISK_BLOCKER = 'RISK_BLOCKER',
  DEPENDENCY = 'DEPENDENCY',
  OWNERSHIP_CONTACT = 'OWNERSHIP_CONTACT',
  NEXT_ACTION = 'NEXT_ACTION',
}

export enum ClaimVerificationStatus {
  EXTRACTED = 'EXTRACTED',
  VERIFIED = 'VERIFIED',
  MISSING_EVIDENCE = 'MISSING_EVIDENCE',
  CONFLICTED = 'CONFLICTED',
  HUMAN_APPROVED = 'HUMAN_APPROVED',
  SUPERSEDED = 'SUPERSEDED',
  REJECTED = 'REJECTED',
}

export enum ExtractionOrigin {
  DETERMINISTIC = 'DETERMINISTIC',
  AI_ENRICHED = 'AI_ENRICHED',
  HUMAN_AUTHORED = 'HUMAN_AUTHORED',
}

export enum ReconstructionMode {
  DETERMINISTIC = 'DETERMINISTIC',
  AI_ENRICHED = 'AI_ENRICHED',
  AI_FALLBACK = 'AI_FALLBACK',
}

export enum ProjectRole {
  MAINTAINER = 'MAINTAINER',
  REVIEWER = 'REVIEWER',
  INCOMING_OWNER = 'INCOMING_OWNER',
  EXTERNAL_AUDITOR = 'EXTERNAL_AUDITOR',
}

export enum ConflictResolutionOption {
  CLAIM_A = 'CLAIM_A',
  CLAIM_B = 'CLAIM_B',
  SYNTHESIZE = 'SYNTHESIZE',
}

export enum ConflictStatus {
  OPEN = 'OPEN',
  RESOLVED = 'RESOLVED',
}

export enum InterviewStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
}

export type PersistenceMode = 'supabase' | 'seed';

export interface RedactionRecord {
  patternType: string;
  originalLength: number;
  sanitizedStart: number;
  sanitizedEnd: number;
  replacementToken: string;
}

export interface CandidateFact {
  category: ClaimCategory;
  topicKey: string;
  stanceValue?: string;
  title: string;
  summary: string;
  sourceId: string;
  charStart: number;
  charEnd: number;
  confidenceScore: number;
  extractionOrigin: 'DETERMINISTIC';
}

export * from '../domain/entities/organization';
export * from '../domain/entities/membership';
export * from '../domain/entities/project';
export * from '../domain/entities/source';
export * from '../domain/entities/claim';
export * from '../domain/entities/conflict';
export * from '../domain/entities/interview';
export * from '../domain/entities/graph';
export * from '../domain/entities/snapshot';
export * from '../domain/entities/audit';
