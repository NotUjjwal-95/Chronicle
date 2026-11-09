export * from './enums';

import { ClaimCategory } from './enums';

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
