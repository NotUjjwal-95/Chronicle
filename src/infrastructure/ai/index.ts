import { AIAdapter } from './ai-adapter-interface';
import { GeminiAdapter } from './gemini-adapter';
import { OpenAIAdapter } from './openai-adapter';

export function createAiAdapter(provider?: 'gemini' | 'openai'): AIAdapter {
  const selected = provider || (process.env.AI_PROVIDER as 'gemini' | 'openai') || 'gemini';
  if (selected === 'openai') {
    return new OpenAIAdapter();
  }
  return new GeminiAdapter();
}

export * from './ai-adapter-interface';
export * from './gemini-adapter';
export * from './openai-adapter';
