#!/usr/bin/env node
import { existsSync, writeFileSync, readFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const CACHE_DIR = resolve(root, '.heal-cache');
const CACHE_FILE = resolve(CACHE_DIR, 'working-models.json');
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

const colors = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};

function ok(msg) { console.log(` ${colors.green('✓')} ${msg}`); }
function warn(msg) { console.log(` ${colors.yellow('⚠')} ${msg}`); }
function fail(msg) { console.log(` ${colors.red('✗')} ${msg}`); }

function getApiKeys() {
  const envVal = process.env.OPENROUTER_API_KEYS || process.env.OPENROUTER_API_KEY || '';
  return envVal.split(',').map((k) => k.trim()).filter(Boolean);
}

function httpsGet(url) {
  return new Promise((resolvePromise, reject) => {
    https.get(url, { timeout: 15000, headers: { 'User-Agent': 'VibeCoder/1.0' } }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode === 200) {
          try { resolvePromise(JSON.parse(data)); }
          catch (e) { reject(new Error(`Parse error: ${e.message}`)); }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
        }
      });
    }).on('error', reject);
  });
}

function openRouterPost(key, body) {
  return new Promise((resolvePromise) => {
    const payload = JSON.stringify(body);
    const req = https.request({
      hostname: 'openrouter.ai',
      path: '/api/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        'User-Agent': 'VibeCoder/1.0',
      },
      timeout: 15000,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode === 200) {
          try { resolvePromise({ ok: true, data: JSON.parse(data) }); }
          catch { resolvePromise({ ok: false, error: 'Parse error' }); }
        } else {
          resolvePromise({ ok: false, status: res.statusCode, error: data.slice(0, 200) });
        }
      });
    });
    req.on('error', (e) => resolvePromise({ ok: false, error: e.message }));
    req.write(payload);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// 1. Fetch available models from OpenRouter
// ---------------------------------------------------------------------------
async function fetchAvailableModels() {
  const data = await httpsGet('https://openrouter.ai/api/v1/models');
  return (data.data || []).filter(m => m.id && m.id.includes(':free'));
}

// ---------------------------------------------------------------------------
// 2. Test each key against each free model
// ---------------------------------------------------------------------------
async function testModel(key, modelId) {
  const result = await openRouterPost(key, {
    model: modelId,
    messages: [{ role: 'user', content: 'ping' }],
    max_tokens: 1,
  });
  if (result.ok) return { model: modelId, working: true };
  // Rate limited models may still work — treat as working
  if (result.status === 429) return { model: modelId, working: true, note: 'rate_limited' };
  return { model: modelId, working: false, error: result.error?.slice(0, 100) };
}

// ---------------------------------------------------------------------------
// 3. Read cache (if fresh)
// ---------------------------------------------------------------------------
function readCache() {
  if (!existsSync(CACHE_FILE)) return null;
  try {
    const cached = JSON.parse(readFileSync(CACHE_FILE, 'utf-8'));
    const age = Date.now() - new Date(cached.discoveredAt).getTime();
    if (age < CACHE_TTL_MS) return cached;
    return null;
  } catch { return null; }
}

function writeCache(data) {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const forceRefresh = process.argv.includes('--force');

  // Check cache first
  if (!forceRefresh) {
    const cached = readCache();
    if (cached) {
      console.log(` Using cached models (${cached.models.length} available, from ${cached.discoveredAt})\n`);
      console.log(JSON.stringify(cached.models, null, 2));
      process.exit(0);
    }
  }

  const keys = getApiKeys();
  if (keys.length === 0) {
    fail('No API keys found in OPENROUTER_API_KEYS or OPENROUTER_API_KEY');
    process.exit(1);
  }

  console.log(`\n Discovering working free models (${keys.length} key(s))...\n`);

  // Fetch all free models from OpenRouter
  let freeModels;
  try {
    freeModels = await fetchAvailableModels();
    ok(`Found ${freeModels.length} free models on OpenRouter`);
  } catch (e) {
    warn(`Could not fetch model list: ${e.message}. Using fallback.`);
    freeModels = [];
  }

  // Use auto-discovered or fallback list
  const modelIds = freeModels.length > 0
    ? freeModels.map(m => m.id)
    : [
        'google/gemini-2.0-flash-exp:free',
        'deepseek/deepseek-chat:free',
        'mistralai/mistral-small-24b-instruct-2501:free',
        'nousresearch/deephermes-3-mistral-24b:free',
        'qwen/qwen3-coder:free',
      ];

  // Test each model with each key
  const workingModels = [];
  const seen = new Set();

  for (const key of keys) {
    const keySuffix = key.slice(-4);
    console.log(`\n Testing key ...${keySuffix} against ${modelIds.length} model(s)...`);

    for (const modelId of modelIds) {
      if (seen.has(modelId)) continue;
      const result = await testModel(key, modelId);
      if (result.working) {
        seen.add(modelId);
        workingModels.push(result.model);
        ok(`${result.model} ${result.note ? `(${result.note})` : ''}`);
      } else {
        console.log(`  ${colors.dim('✗')} ${colors.dim(modelId)}: ${result.error}`);
      }
    }

    if (workingModels.length > 0) break; // Stop once we find working models
  }

  if (workingModels.length === 0) {
    warn('No working free models found. Try adding a new API key or using paid models.');
    // Still cache the empty result so we don't spam API
  } else {
    ok(`${workingModels.length} working model(s) found`);
  }

  const cacheData = {
    discoveredAt: new Date().toISOString(),
    models: workingModels,
    validKeys: workingModels.length > 0 ? 1 : 0,
    totalKeys: keys.length,
  };

  writeCache(cacheData);
  console.log(`\n${JSON.stringify(workingModels, null, 2)}\n`);
}

main().catch((e) => {
  console.error(`Model discovery failed: ${e.message}`);
  process.exit(1);
});
