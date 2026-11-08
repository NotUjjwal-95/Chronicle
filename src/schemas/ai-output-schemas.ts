import { z } from 'zod';
import { ClaimCategory } from '../types';

export const AiExtractedClaimSchema = z.object({
  category: z.nativeEnum(ClaimCategory),
  topicKey: z.string().min(2).max(120),
  stanceValue: z.string().min(1).max(160),
  title: z.string().min(4).max(220),
  summary: z.string().min(8).max(1500),
  sourceId: z.string().min(1),
  verbatimQuote: z.string().min(4).max(1000),
  confidenceScore: z.number().min(0).max(1),
  ownerHandle: z.string().optional(),
  modulePaths: z.array(z.string()).default([]),
});

export const AiReconstructionOutputSchema = z.object({
  claims: z.array(AiExtractedClaimSchema),
  narrativeSummary: z.string().min(5).max(3000),
});

export type AiExtractedClaim = z.infer<typeof AiExtractedClaimSchema>;
export type AiReconstructionOutput = z.infer<typeof AiReconstructionOutputSchema>;
