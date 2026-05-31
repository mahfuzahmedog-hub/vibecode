import OpenAI from 'openai';
import { getMcpClient } from './mcp-client';

export const MODEL_PRIORITY: string[] = (() => {
  const envModels = process.env.MODEL_PRIORITY;
  if (envModels) return envModels.split(',').map(m => m.trim()).filter(Boolean);
  return [
    'qwen/qwen3-coder:free',
    'deepseek/deepseek-chat:free',
    'google/gemini-2.0-flash-exp:free',
    'mistralai/mistral-small-24b-instruct-2501:free',
    'nousresearch/deephermes-3-mistral-24b:free',
  ];
})();

function getApiKeys(): string[] {
  const apiKeysEnv = process.env.OPENROUTER_API_KEYS;
  if (apiKeysEnv) {
    return apiKeysEnv
      .split(',')
      .map((key) => key.trim())
      .filter((key): key is string => key.length > 0);
  }

  const singleKey = process.env.OPENROUTER_API_KEY;
  if (singleKey && singleKey !== 'your_key_here') {
    return [singleKey];
  }

  return [];
}

export async function generateVibeCodeStream(
  prompt: string,
  errorContext: string | null = null,
  preferredModel: string | null = null
): Promise<{ stream: ReadableStream; model: string }> {
  const apiKeys = getApiKeys();
  if (apiKeys.length === 0) {
    throw new Error('No OpenRouter API Keys are configured.');
  }

  // Determine model order: preferred model first, then fallback to priority list
  const modelsToTry: string[] = [];
  if (preferredModel && MODEL_PRIORITY.includes(preferredModel)) {
    modelsToTry.push(preferredModel);
  }
  // Add all models from priority list, avoiding duplicates
  for (const model of MODEL_PRIORITY) {
    if (!modelsToTry.includes(model)) {
      modelsToTry.push(model);
    }
  }

  // Try each API key in order
  let lastError: Error | null = null;
  for (const apiKey of apiKeys) {
    const client = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: apiKey,
      defaultHeaders: {
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'VibeCoder Pro',
      },
    });

    // Build enhanced system prompt with MCP tool awareness
    let systemPrompt = `You are an expert software engineer.
Generate production-ready code.
STRICT RULES:
- Return ONLY source code.
- No markdown, no code fences, no explanations.
- Ensure it is complete and executable.`;

    // Add MCP tool information if available
    try {
      const mcpUrl = process.env.N8N_MCP_SERVER_URL || '';
      if (mcpUrl && mcpUrl !== 'your_n8n_mcp_server_url_here') {
        const mcpClient = getMcpClient(mcpUrl);
        await mcpClient.connect();
        const tools = await mcpClient.listTools();
        systemPrompt += `

You have access to n8n workflow automation via MCP (Model Context Protocol).
Available MCP tools:
${tools.map(t => `- ${t.name}: ${t.description}`).join('\n')}

When the user asks to create a workflow, generate the n8n workflow JSON definition.
To execute a tool, output a JSON block like: {"_type":"mcp_call","tool":"TOOL_NAME","args":{...}}`;
      }
    } catch (mcpError) {
      // Silently continue if MCP is not available
      const errorMessage = mcpError instanceof Error ? mcpError.message : 'Unknown error';
      console.debug('MCP not available for enhanced system prompt:', errorMessage);
    }

    const fixPrompt = `The previous code generation resulted in the following error:
${errorContext}

Please provide the corrected version of the full code.
STRICT RULES: Return ONLY the corrected source code. No markdown, no code fences, no explanations.`;

    const finalPrompt = errorContext ? fixPrompt : prompt;

    // Try each model in order with this API key
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

        // Convert the OpenAI stream (async iterable) to a ReadableStream
        const readableStream = new ReadableStream({
          async start(controller) {
            try {
              // The stream is an async iterable of ChatCompletionChunk
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
          }
        });

        return { stream: readableStream, model };
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));
        // Check if it's a rate limit error (429) to possibly try the next key sooner
        const err = error as { status?: number; message?: string };
        const isRateLimit = err.status === 429 ||
                      (err.message && err.message.includes('429')) ||
                      (err.message && err.message.includes('rate limit'));
        if (isRateLimit) {
          console.warn(`API key ending in ${apiKey.slice(-4)} hit rate limit, trying next key`);
          // Break out of the model loop to try the next API key
          break;
        } else {
          console.warn(`Model ${model} failed with API key ending in ${apiKey.slice(-4)}:`, err.message);
          // Continue to try the next model with the same API key
          continue;
        }
      }
    }
    // If we tried all models with this API key and none worked, we continue to the next API key
    // (unless we broke due to rate limit, in which case we already moved to the next key)
  }

  // If all API keys and models failed, throw the last error
  throw new Error(`All API keys and models failed. Last error: ${lastError?.message || 'Unknown error'}`);
}

export async function generateVibeStep(
  role: string,
  prompt: string,
  context: string | null = null,
  preferredModel: string | null = null
): Promise<string> {
  const apiKeys = getApiKeys();
  if (apiKeys.length === 0) {
    throw new Error('No OpenRouter API Keys are configured.');
  }

  // Determine model order: preferred model first, then fallback to priority list
  const modelsToTry: string[] = [];
  if (preferredModel && MODEL_PRIORITY.includes(preferredModel)) {
    modelsToTry.push(preferredModel);
  }
  // Add all models from priority list, avoiding duplicates
  for (const model of MODEL_PRIORITY) {
    if (!modelsToTry.includes(model)) {
      modelsToTry.push(model);
    }
  }

  // Try each API key in order
  let lastError: Error | null = null;
  for (const apiKey of apiKeys) {
    const client = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: apiKey,
      defaultHeaders: {
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'VibeCoder Pro',
      },
    });

    let systemPrompt = '';
    if (role === 'CEO') {
      systemPrompt = `You are a CEO providing strategic business guidance.
Provide clear, actionable business advice.
STRICT RULES:
- Return ONLY plain text advice.
- No markdown, no code fences, no explanations.
- Ensure it is complete and actionable.`;
    } else if (role === 'DESIGNER') {
      systemPrompt = `You are a senior designer providing design guidance.
Provide clear, actionable design advice.
STRICT RULES:
- Return ONLY plain text advice.
- No markdown, no code fences, no explanations.
- Ensure it is complete and actionable.`;
    } else {
      systemPrompt = `You are a helpful assistant.
Provide clear, helpful responses.
STRICT RULES:
- Return ONLY plain text.
- No markdown, no code fences, no explanations.
- Ensure it is complete and helpful.`;
    }

    // Add MCP tool awareness to step generation
    try {
      const mcpUrl = process.env.N8N_MCP_SERVER_URL || '';
      if (mcpUrl && mcpUrl !== 'your_n8n_mcp_server_url_here') {
        const mcpClient = getMcpClient(mcpUrl);
        await mcpClient.connect();
        const tools = await mcpClient.listTools();
        systemPrompt += `\n\nAvailable n8n workflow automation tools via MCP:\n${tools.map(t => `- ${t.name}: ${t.description}`).join('\n')}\n\nIf the user asks for workflow creation, you can describe the n8n workflow definition.`;
      }
    } catch {
      // Silently continue
    }

    const finalPrompt = context
      ? `Context: ${context}\n\nRequest: ${prompt}`
      : prompt;

    // Try each model in order with this API key
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
        const isRateLimit = err.status === 429 ||
                          (err.message && err.message.includes('429')) ||
                          (err.message && err.message.includes('rate limit'));
        if (isRateLimit) {
          console.warn(`API key ending in ${apiKey.slice(-4)} hit rate limit for generateVibeStep, trying next key`);
          break;
        } else {
          console.warn(`Model ${model} failed for generateVibeStep with API key ending in ${apiKey.slice(-4)}:`, err.message);
          continue;
        }
      }
    }
    // If we tried all models with this API key and none worked, we continue to the next API key
  }

  // If all API keys and models failed, throw the last error
  throw new Error(`All API keys and models failed for generateVibeStep. Last error: ${lastError?.message || 'Unknown error'}`);
}

// Placeholder for cache functions (to be implemented later)
export function clearResponseCache() {
  // TODO: Implement cache clearing
}

export function getCacheStats() {
  // TODO: Implement cache stats
  return {
    size: 0,
    keys: []
  };
}