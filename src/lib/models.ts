// Client-safe model list — no fs imports, safe for browser bundling
export const FALLBACK_MODELS = [
  'google/gemini-2.0-flash-exp:free',
  'deepseek/deepseek-chat:free',
  'mistralai/mistral-small-24b-instruct-2501:free',
  'nousresearch/deephermes-3-mistral-24b:free',
  'qwen/qwen3-coder:free',
];

export const MODEL_PRIORITY: string[] = (() => {
  const envModels = typeof process !== 'undefined' && process.env?.MODEL_PRIORITY;
  if (envModels) return envModels.split(',').map(m => m.trim()).filter(Boolean);
  return [...FALLBACK_MODELS];
})();
