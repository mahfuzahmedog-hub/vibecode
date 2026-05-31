import OpenAI from 'openai';

export type AIProvider = 'openrouter' | 'openai' | 'anthropic' | 'google';

function streamToReadable(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): ReadableStream {
  return new ReadableStream({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
        controller.close();
      } catch (e) {
        controller.error(e);
      }
    },
  });
}

function buildSystemPrompt(role?: string): string {
  if (role === 'CEO') {
    return `You are a CEO providing strategic business guidance. Provide clear, actionable business advice. Return ONLY plain text. No markdown, no code fences, no explanations.`;
  }
  if (role === 'DESIGNER') {
    return `You are a senior designer providing design guidance. Provide clear, actionable design advice. Return ONLY plain text. No markdown, no code fences, no explanations.`;
  }
  return `You are an expert software engineer. Generate production-ready code. STRICT RULES: Return ONLY source code. No markdown, no code fences, no explanations. Ensure it is complete and executable.`;
}

function buildOpenAIClient(apiKey: string, baseURL?: string) {
  return new OpenAI({
    apiKey,
    baseURL,
    timeout: 120_000,
    defaultHeaders: {
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'VibeCoder Pro',
    },
  });
}

export async function generateStream(
  provider: AIProvider,
  apiKey: string,
  model: string,
  prompt: string,
  systemRole?: string,
): Promise<{ stream: ReadableStream; model: string }> {
  const systemPrompt = buildSystemPrompt(systemRole);

  if (provider === 'openrouter') {
    const client = buildOpenAIClient(apiKey, 'https://openrouter.ai/api/v1');
    const response = await client.chat.completions.create({
      model,
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
    });

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const part of response) {
            const content = part.choices[0]?.delta?.content || '';
            if (content) controller.enqueue(new TextEncoder().encode(content));
          }
          controller.close();
        } catch (e) {
          controller.error(e);
        }
      },
    });
    return { stream, model };
  }

  if (provider === 'openai') {
    const client = buildOpenAIClient(apiKey);
    const response = await client.chat.completions.create({
      model,
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
    });

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const part of response) {
            const content = part.choices[0]?.delta?.content || '';
            if (content) controller.enqueue(new TextEncoder().encode(content));
          }
          controller.close();
        } catch (e) {
          controller.error(e);
        }
      },
    });
    return { stream, model };
  }

  if (provider === 'anthropic') {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        stream: true,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${text.slice(0, 200)}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('Anthropic stream not available');

    const decoder = new TextDecoder();
    const passThrough = new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            for (const line of chunk.split('\n').filter(l => l.startsWith('data: '))) {
              try {
                const json = JSON.parse(line.slice(6));
                if (json.type === 'content_block_delta' && json.delta?.text) {
                  controller.enqueue(new TextEncoder().encode(json.delta.text));
                }
              } catch { /* skip malformed lines */ }
            }
          }
          controller.close();
        } catch (e) {
          controller.error(e);
        }
      },
    });
    return { stream: passThrough, model };
  }

  if (provider === 'google') {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${prompt}` }] }],
        }),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Google API error (${response.status}): ${text.slice(0, 200)}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('Google stream not available');

    const passThrough = new ReadableStream({
      async start(controller) {
        try {
          const decoder = new TextDecoder();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            for (const line of chunk.split('\n').filter(l => l.trim())) {
              try {
                const json = JSON.parse(line);
                const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) controller.enqueue(new TextEncoder().encode(text));
              } catch { /* skip */ }
            }
          }
          controller.close();
        } catch (e) {
          controller.error(e);
        }
      },
    });
    return { stream: passThrough, model };
  }

  throw new Error(`Unknown provider: ${provider}`);
}

export async function generateSync(
  provider: AIProvider,
  apiKey: string,
  model: string,
  prompt: string,
  systemRole?: string,
): Promise<string> {
  const systemPrompt = buildSystemPrompt(systemRole);

  if (provider === 'openrouter' || provider === 'openai') {
    const baseURL = provider === 'openrouter' ? 'https://openrouter.ai/api/v1' : undefined;
    const client = buildOpenAIClient(apiKey, baseURL);
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
    });
    return response.choices[0]?.message?.content || '';
  }

  if (provider === 'anthropic') {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${text.slice(0, 200)}`);
    }

    const data = await response.json();
    return data.content?.[0]?.text || '';
  }

  if (provider === 'google') {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${prompt}` }] }],
        }),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Google API error (${response.status}): ${text.slice(0, 200)}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  throw new Error(`Unknown provider: ${provider}`);
}

export const AI_PROVIDER_MODELS: Record<AIProvider, string[]> = {
  openrouter: [
    'qwen/qwen3-coder:free',
    'google/gemini-2.0-flash-exp:free',
    'deepseek/deepseek-chat:free',
  ],
  openai: [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'gpt-3.5-turbo',
  ],
  anthropic: [
    'claude-sonnet-4-20250514',
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022',
  ],
  google: [
    'gemini-2.0-flash-exp',
    'gemini-2.0-flash',
    'gemini-1.5-pro',
    'gemini-1.5-flash',
  ],
};

export const AI_PROVIDER_LABELS: Record<AIProvider, string> = {
  openrouter: 'OpenRouter (Free models)',
  openai: 'OpenAI (GPT-4o, GPT-4o-mini)',
  anthropic: 'Anthropic (Claude)',
  google: 'Google (Gemini)',
};
