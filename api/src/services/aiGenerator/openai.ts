import { JobError } from './worker.js';

/**
 * Minimal OpenAI client for the plan generator (plain fetch, no SDK). Model names and prices are
 * environment settings so a renamed or cheaper model is a config change, not a code change.
 */

const num = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

export const aiSettings = () => ({
  apiKey: process.env.OPENAI_API_KEY ?? '',
  baseUrl: (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
  agentModel: process.env.AI_AGENT_MODEL || 'gpt-5.4-mini',
  criticModel: process.env.AI_CRITIC_MODEL || process.env.AI_AGENT_MODEL || 'gpt-5.4-mini',
  /** USD per 1M tokens, used to track each batch's spend. Set them to your model's prices. */
  priceInPerM: num(process.env.AI_PRICE_INPUT_PER_M, 0.75),
  priceOutPerM: num(process.env.AI_PRICE_OUTPUT_PER_M, 4.5),
  imageModel: process.env.AI_IMAGE_MODEL || 'gpt-image-2',
  imageQuality: process.env.AI_IMAGE_QUALITY || 'low',
  /** Estimated USD per generated image (images are billed by token; this keeps tracking simple). */
  imageCostUsd: num(process.env.AI_IMAGE_COST_USD, 0.02),
});

export const isOpenAiConfigured = () => !!aiSettings().apiKey;

export type ChatMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };

export type ToolCall = { id: string; type: 'function'; function: { name: string; arguments: string } };

export type ToolDefinition = {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
};

/** Turns an OpenAI error status into a job error: rate limits and outages are worth a retry. */
const failure = (status: number, body: string, costUsd = 0): JobError => {
  let detail = body.slice(0, 300);
  try {
    detail = JSON.parse(body)?.error?.message ?? detail;
  } catch {
    // keep the raw text
  }
  if (status === 401 || status === 403) return new JobError(`OpenAI rejected the API key: ${detail}`, false, costUsd);
  if (status === 429 || status >= 500) return new JobError(`OpenAI is busy (${status}): ${detail}`, true, costUsd);
  return new JobError(`OpenAI request failed (${status}): ${detail}`, false, costUsd);
};

const post = async (path: string, body: unknown, signal: AbortSignal) => {
  const { apiKey, baseUrl } = aiSettings();
  if (!apiKey) throw new JobError('OPENAI_API_KEY is not set on the server.');
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  const text = await response.text();
  if (!response.ok) throw failure(response.status, text);
  return JSON.parse(text);
};

export type ChatResult = { message: Extract<ChatMessage, { role: 'assistant' }>; costUsd: number; inputTokens: number; outputTokens: number };

/** One chat completion, optionally with tools or a forced JSON reply. */
export const chat = async (
  options: { model: string; messages: ChatMessage[]; tools?: ToolDefinition[]; json?: boolean; maxOutputTokens?: number },
  signal: AbortSignal,
): Promise<ChatResult> => {
  const settings = aiSettings();
  const payload = await post(
    '/chat/completions',
    {
      model: options.model,
      messages: options.messages,
      ...(options.tools?.length ? { tools: options.tools, tool_choice: 'auto', parallel_tool_calls: false } : {}),
      ...(options.json ? { response_format: { type: 'json_object' } } : {}),
      max_completion_tokens: options.maxOutputTokens ?? 8000,
    },
    signal,
  );
  const inputTokens = Number(payload?.usage?.prompt_tokens ?? 0);
  const outputTokens = Number(payload?.usage?.completion_tokens ?? 0);
  const costUsd = (inputTokens * settings.priceInPerM + outputTokens * settings.priceOutPerM) / 1_000_000;
  const message = payload?.choices?.[0]?.message;
  if (!message) throw new JobError('OpenAI returned no message.', true, costUsd);
  return {
    message: { role: 'assistant', content: message.content ?? null, ...(message.tool_calls?.length ? { tool_calls: message.tool_calls } : {}) },
    costUsd,
    inputTokens,
    outputTokens,
  };
};

/** Generates one square image and returns its bytes (PNG). */
export const generateImage = async (prompt: string, signal: AbortSignal): Promise<{ data: Buffer; costUsd: number }> => {
  const settings = aiSettings();
  const payload = await post(
    '/images/generations',
    { model: settings.imageModel, prompt, size: '1024x1024', quality: settings.imageQuality, n: 1 },
    signal,
  );
  const b64 = payload?.data?.[0]?.b64_json;
  if (typeof b64 === 'string') return { data: Buffer.from(b64, 'base64'), costUsd: settings.imageCostUsd };

  const url = payload?.data?.[0]?.url;
  if (typeof url !== 'string') throw new JobError('OpenAI returned no image.', true, settings.imageCostUsd);
  const download = await fetch(url, { signal });
  if (!download.ok) throw new JobError(`Could not download the generated image (${download.status}).`, true, settings.imageCostUsd);
  return { data: Buffer.from(await download.arrayBuffer()), costUsd: settings.imageCostUsd };
};
