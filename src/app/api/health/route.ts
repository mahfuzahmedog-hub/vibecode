import { NextRequest, NextResponse } from 'next/server';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const CACHE_FILE = resolve(process.cwd(), '.heal-cache', 'working-models.json');

function getApiKeys(): string[] {
  const apiKeysEnv = process.env.OPENROUTER_API_KEYS;
  if (apiKeysEnv) {
    return apiKeysEnv.split(',').map((key) => key.trim()).filter((key) => key.length > 0);
  }
  const singleKey = process.env.OPENROUTER_API_KEY;
  if (singleKey && singleKey !== 'your_key_here') {
    return [singleKey];
  }
  return [];
}

function getCachedModels(): string[] {
  try {
    if (existsSync(CACHE_FILE)) {
      const data = JSON.parse(readFileSync(CACHE_FILE, 'utf-8'));
      if (Array.isArray(data.models) && data.models.length > 0) return data.models;
    }
  } catch { /* ignore */ }
  return [];
}

export async function GET(request: NextRequest) {
  const keys = getApiKeys();
  const cached = getCachedModels();

  return NextResponse.json({
    status: keys.length > 0 ? 'ok' : 'degraded',
    apiKeys: keys.length,
    models: cached.length > 0 ? cached : null,
    modelCount: cached.length,
    mcpEnabled: process.env.N8N_MCP_ENABLED === 'true',
    nodeVersion: process.version,
    platform: process.platform,
    timestamp: new Date().toISOString(),
    tips: keys.length === 0
      ? ['No API keys configured. Set OPENROUTER_API_KEYS or OPENROUTER_API_KEY in .env.local, or enter one in Settings.']
      : cached.length === 0
        ? ['No working models cached. Run `npm run discover-models` or start dev to auto-discover.']
        : [],
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const testKey = body.apiKey?.trim();

    if (!testKey) {
      return NextResponse.json({ error: 'apiKey is required' }, { status: 400 });
    }

    // Validate the key by making a lightweight API call
    const response = await fetch('https://openrouter.ai/api/v1/auth/key', {
      headers: { Authorization: `Bearer ${testKey}` },
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json({
        valid: false,
        error: text.slice(0, 200),
        status: response.status,
      });
    }

    const data = await response.json();
    return NextResponse.json({
      valid: true,
      data,
    });
  } catch (error) {
    return NextResponse.json({
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
