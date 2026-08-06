import Anthropic from '@anthropic-ai/sdk';
import { requireEnv, getEnv } from './env.js';

let client: Anthropic | undefined;

function anthropic(): Anthropic {
  client ??= new Anthropic({ apiKey: requireEnv('ANTHROPIC_API_KEY') });
  return client;
}

// Model switching rule: haiku for bulk/repetitive work, sonnet for anything
// a real human will read. Overridable via env in case model IDs change.
export const MODELS = {
  bulk: getEnv('MODEL_BULK') ?? 'claude-haiku-4-5-20251001',
  quality: getEnv('MODEL_QUALITY') ?? 'claude-sonnet-5',
} as const;

export async function ask(
  tier: keyof typeof MODELS,
  system: string,
  prompt: string,
  maxTokens = 2048
): Promise<string> {
  const res = await anthropic().messages.create({
    model: MODELS[tier],
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: prompt }],
  });
  // claude-sonnet-5 returns extended-thinking content as a leading `thinking`
  // block, so the real answer isn't always content[0] — collect every `text`
  // block instead of assuming position.
  return res.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
}
