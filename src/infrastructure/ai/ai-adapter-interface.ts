import { ClearanceTier, SanitizedSource } from '../../types';
import { AiReconstructionOutput } from '../../schemas/ai-output-schemas';

export interface AIAdapter {
  readonly providerName: 'gemini' | 'openai';
  reconstruct(
    sources: SanitizedSource[],
    targetClearanceTier: ClearanceTier
  ): Promise<AiReconstructionOutput>;
}
