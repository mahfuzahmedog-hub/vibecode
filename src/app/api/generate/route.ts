import { generateVibeCodeStream } from '@/lib/openrouter';
import { generateStream, type AIProvider } from '@/lib/ai-client';
import { NextResponse } from 'next/server';
import { generateSchema } from '@/lib/validation';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = generateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid request' }, { status: 400 });
    }

    const { prompt, error, model } = parsed.data;
    const userApiKey = request.headers.get('x-api-key') || undefined;
    const provider = (request.headers.get('x-api-provider') || 'openrouter') as AIProvider;

    const providerDefaults: Record<AIProvider, string> = {
      openrouter: 'qwen/qwen3-coder:free',
      openai: 'gpt-4o',
      anthropic: 'claude-sonnet-4-20250514',
      google: 'gemini-2.0-flash-exp',
    };

    if (userApiKey) {
      const finalPrompt = error
        ? `The previous code generation resulted in this error:\n${error}\n\nPlease provide the corrected version of the full code. Return ONLY the corrected source code. No markdown, no code fences, no explanations.`
        : (prompt || '');
      const usedModel = model || providerDefaults[provider];
      const result = await generateStream(provider, userApiKey, usedModel, finalPrompt);
      return new Response(result.stream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Model': result.model,
        },
      });
    }

    // Server-side: fall back to OpenRouter
    const { stream, model: usedModel } = await generateVibeCodeStream(prompt ?? '', error || null, model ?? null);

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Model': usedModel,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
