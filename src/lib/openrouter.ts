import OpenAI from 'openai';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { getMcpClient } from './mcp-client';
import { FALLBACK_MODELS } from './models';

export { FALLBACK_MODELS, MODEL_PRIORITY } from './models';

function getCachedModels(): string[] {
  try {
    const cachePath = resolve(process.cwd(), '.heal-cache', 'working-models.json');
    if (existsSync(cachePath)) {
      const data = JSON.parse(readFileSync(cachePath, 'utf-8'));
      if (Array.isArray(data.models) && data.models.length > 0) return data.models;
    }
  } catch (e) {
    console.error('Failed to read cached models:', e);
  }
  return [];
}

export function buildModelList(preferredModel: string | null): string[] {
  const models: string[] = [];
  if (preferredModel) models.push(preferredModel);
  // Try auto-discovered cache first, then env config, then fallback
  const cached = getCachedModels();
  const priority = cached.length > 0 ? cached : (process.env.MODEL_PRIORITY?.split(',').map(m => m.trim()).filter(Boolean) || FALLBACK_MODELS);
  for (const m of priority) {
    if (!models.includes(m)) models.push(m);
  }
  for (const m of FALLBACK_MODELS) {
    if (!models.includes(m)) models.push(m);
  }
  return models;
}

function getApiKeys(clientApiKey?: string): string[] {
  const keys: string[] = [];
  // Client-supplied key (from in-app settings) tried first
  if (clientApiKey && clientApiKey.trim()) {
    keys.push(clientApiKey.trim());
  }
  // Then env var keys
  const apiKeysEnv = process.env.OPENROUTER_API_KEYS;
  if (apiKeysEnv) {
    for (const key of apiKeysEnv.split(',').map(k => k.trim()).filter(Boolean)) {
      if (!keys.includes(key)) keys.push(key);
    }
  }
  const singleKey = process.env.OPENROUTER_API_KEY;
  if (singleKey && singleKey !== 'your_key_here') {
    if (!keys.includes(singleKey)) keys.push(singleKey);
  }
  return keys;
}

function buildSystemPromptSync(): string {
  return `You are an expert software engineer.
Generate production-ready code.
STRICT RULES:
- Return ONLY source code.
- No markdown, no code fences, no explanations.
- Ensure it is complete and executable.`;
}

function buildStepSystemPrompt(role: string): string {
  if (role === 'CEO') {
    return `You are a CEO providing strategic business guidance.
Provide clear, actionable business advice.
STRICT RULES:
- Return ONLY plain text advice.
- No markdown, no code fences, no explanations.
- Ensure it is complete and actionable.`;
  }
  if (role === 'DESIGNER') {
    return `You are a senior designer providing design guidance.
Provide clear, actionable design advice.
STRICT RULES:
- Return ONLY plain text advice.
- No markdown, no code fences, no explanations.
- Ensure it is complete and actionable.`;
  }
  return `You are a helpful assistant.
Provide clear, helpful responses.
STRICT RULES:
- Return ONLY plain text.
- No markdown, no code fences, no explanations.
- Ensure it is complete and helpful.`;
}

// ---------------------------------------------------------------------------
// Streaming generation (for Code mode)
// ---------------------------------------------------------------------------
export async function generateVibeCodeStream(
  prompt: string,
  errorContext: string | null = null,
  preferredModel: string | null = null,
  clientApiKey?: string,
): Promise<{ stream: ReadableStream; model: string }> {
  const apiKeys = getApiKeys(clientApiKey);
  if (apiKeys.length === 0) {
    throw new Error('No OpenRouter API Keys are configured.');
  }

  const modelsToTry = buildModelList(preferredModel);

  // Enhanced system prompt with MCP tools
  let systemPrompt = buildSystemPromptSync();
  try {
    const mcpUrl = process.env.N8N_MCP_SERVER_URL || '';
    if (mcpUrl && mcpUrl !== 'your_n8n_mcp_server_url_here') {
      const mcpClient = getMcpClient(mcpUrl);
      await mcpClient.connect();
      const tools = await mcpClient.listTools();
      systemPrompt += `\n\nYou have access to n8n workflow automation via MCP (Model Context Protocol).
Available MCP tools:
${tools.map(t => `- ${t.name}: ${t.description}`).join('\n')}

When the user asks to create a workflow, generate the n8n workflow JSON definition.
To execute a tool, output a JSON block like: {"_type":"mcp_call","tool":"TOOL_NAME","args":{...}}`;
    }
    } catch (e) {
      console.warn('MCP not available, continuing without:', e instanceof Error ? e.message : e);
    }

  const fixPrompt = `The previous code generation resulted in the following error:
${errorContext}

Please provide the corrected version of the full code.
STRICT RULES: Return ONLY the corrected source code. No markdown, no code fences, no explanations.`;

  const finalPrompt = errorContext ? fixPrompt : prompt;

  let lastError: Error | null = null;
  for (const apiKey of apiKeys) {
    const client = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: apiKey,
      timeout: 120_000,
      defaultHeaders: {
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'VibeCoder Pro',
      },
    });

    for (const model of modelsToTry) {
      try {
        const stream = await client.chat.completions.create({
          model: model,
          stream: true,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: finalPrompt },
          ],
        });

        const readableStream = new ReadableStream({
          async start(controller) {
            try {
              for await (const part of stream) {
                const content = part.choices[0]?.delta?.content || '';
                if (content) {
                  controller.enqueue(new TextEncoder().encode(content));
                }
              }
              controller.close();
            } catch (error) {
              controller.error(error);
            }
          },
        });

        return { stream: readableStream, model };
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const err = error as { status?: number; message?: string };
        if (err.status === 429 || (err.message && (err.message.includes('429') || err.message.includes('rate limit')))) {
          console.warn(`Key ending in ${apiKey.slice(-4)} rate limited on ${model}, next key`);
          break;
        }
        console.warn(`Model ${model} failed (key ...${apiKey.slice(-4)}): ${err.message}`);
      }
    }
  }

  throw new Error(`All API keys and models failed. Last error: ${lastError?.message || 'Unknown error'}`);
}

// ---------------------------------------------------------------------------
// Non-streaming generation (for Plan/Design modes)
// ---------------------------------------------------------------------------
export async function generateVibeStep(
  role: string,
  prompt: string,
  context: string | null = null,
  preferredModel: string | null = null,
  clientApiKey?: string,
): Promise<string> {
  const apiKeys = getApiKeys(clientApiKey);
  if (apiKeys.length === 0) {
    throw new Error('No OpenRouter API Keys are configured.');
  }

  const modelsToTry = buildModelList(preferredModel);
  let systemPrompt = buildStepSystemPrompt(role);

  // Add MCP awareness
  try {
    const mcpUrl = process.env.N8N_MCP_SERVER_URL || '';
    if (mcpUrl && mcpUrl !== 'your_n8n_mcp_server_url_here') {
      const mcpClient = getMcpClient(mcpUrl);
      await mcpClient.connect();
      const tools = await mcpClient.listTools();
      systemPrompt += `\n\nAvailable n8n workflow automation tools via MCP:\n${tools.map(t => `- ${t.name}: ${t.description}`).join('\n')}\n\nIf the user asks for workflow creation, you can describe the n8n workflow definition.`;
    }
  } catch (e) {
    console.warn('MCP not available for step, continuing without:', e instanceof Error ? e.message : e);
  }

  const finalPrompt = context ? `Context: ${context}\n\nRequest: ${prompt}` : prompt;

  let lastError: Error | null = null;
  for (const apiKey of apiKeys) {
    const client = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: apiKey,
      timeout: 60_000,
      defaultHeaders: {
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'VibeCoder Pro',
      },
    });

    for (const model of modelsToTry) {
      try {
        const completion = await client.chat.completions.create({
          model: model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: finalPrompt },
          ],
          stream: false,
        });
        return completion.choices[0]?.message?.content || '';
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const err = error as { status?: number; message?: string };
        if (err.status === 429 || (err.message && (err.message.includes('429') || err.message.includes('rate limit')))) {
          console.warn(`Key ending in ${apiKey.slice(-4)} rate limited on ${model}, next key`);
          break;
        }
        console.warn(`Model ${model} failed (key ...${apiKey.slice(-4)}): ${err.message}`);
      }
    }
  }

  throw new Error(`All API keys and models failed. Last error: ${lastError?.message || 'Unknown error'}`);
}

export function clearResponseCache() { /* no-op */ }

export function getCacheStats() {
  return { size: 0, keys: [] };
}
