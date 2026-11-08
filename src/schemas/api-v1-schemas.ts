import { z } from 'zod';
import {
  ClaimCategory,
  ClaimVerificationStatus,
  ClearanceTier,
  ConflictResolutionOption,
  ProjectRole,
  SourceType,
} from '../types';

export const ClearanceTierSchema = z.union([
  z.literal(ClearanceTier.TIER_1_EXTERNAL),
  z.literal(ClearanceTier.TIER_2_INTERNAL),
  z.literal(ClearanceTier.TIER_3_CONFIDENTIAL),
]);

export const SessionSwitchRequestSchema = z.object({
  userId: z.string().min(1),
  projectId: z.string().min(1).optional(),
  shadowPreviewTier: ClearanceTierSchema.nullable().optional(),
});

export const CreateProjectRequestSchema = z.object({
  slug: z.string().min(2).max(80),
  name: z.string().min(2).max(120),
  description: z.string().min(5).max(1000),
  repositoryUrl: z.string().min(3).max(300),
  departingLeadHandle: z.string().min(2).max(80),
  incomingLeadHandle: z.string().min(2).max(80),
});

export const UpdateProjectRequestSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  description: z.string().min(5).max(1000).optional(),
  departingLeadHandle: z.string().min(2).max(80).optional(),
  incomingLeadHandle: z.string().min(2).max(80).optional(),
});

export const IngestSourceRequestSchema = z.object({
  sourceType: z.nativeEnum(SourceType),
  externalRef: z.string().min(1).max(160),
  title: z.string().min(3).max(200),
  authorHandle: z.string().min(1).max(80),
  accessTier: ClearanceTierSchema,
  rawContent: z.string().min(10).max(50000),
  modulePaths: z.array(z.string().min(1)).default([]),
});

export const GithubPrImportRequestSchema = z.object({
  owner: z.string().min(1).max(100),
  repo: z.string().min(1).max(100),
  pullNumber: z.number().int().positive(),
  accessTier: ClearanceTierSchema.default(ClearanceTier.TIER_2_INTERNAL),
  syntheticFallbackIfOffline: z.boolean().default(true),
});

export const ReconstructRequestSchema = z.object({
  useAiEnrichment: z.boolean().default(false),
  provider: z.enum(['gemini', 'openai']).default('gemini'),
  forceSimulateAiFailure: z.boolean().optional(),
});

export const UpdateClaimRequestSchema = z.object({
  verificationStatus: z.nativeEnum(ClaimVerificationStatus),
  reason: z.string().min(3).max(500),
  category: z.nativeEnum(ClaimCategory).optional(),
});

export const ResolveConflictRequestSchema = z.object({
  resolutionOption: z.nativeEnum(ConflictResolutionOption),
  rationale: z.string().min(5).max(1500),
  synthesizedTitle: z.string().min(3).max(220).optional(),
  synthesizedSummary: z.string().min(10).max(2000).optional(),
  synthesizedStanceValue: z.string().min(1).max(120).optional(),
  createNotionUpdateNextAction: z.boolean().default(false),
});

export const SubmitInterviewRequestSchema = z.object({
  answerTranscript: z.string().min(10).max(10000),
});

export const CreateSnapshotRequestSchema = z.object({
  versionTag: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-zA-Z0-9._-]+$/, 'Version tag must be alphanumeric with dots, dashes, or underscores'),
});

export const VerifySnapshotRequestSchema = z.object({
  expectedDigest: z.string().min(16).max(128).optional(),
});

export const AcknowledgeSnapshotRequestSchema = z.object({
  notes: z.string().min(5).max(1000),
  verifiedDigest: z.string().length(64),
});

export const RoleSchema = z.nativeEnum(ProjectRole);
