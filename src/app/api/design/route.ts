import { NextResponse } from 'next/server';
import { generateVibeStep } from '@/lib/openrouter';
import { generateSync, type AIProvider } from '@/lib/ai-client';
import { designSchema } from '@/lib/validation';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = designSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid request' }, { status: 400 });
    }

    const { prompt, context, model } = parsed.data;
    const userApiKey = request.headers.get('x-api-key') || undefined;
    const provider = (request.headers.get('x-api-provider') || 'openrouter') as AIProvider;

    const providerDefaults: Record<AIProvider, string> = {
      openrouter: 'google/gemini-2.0-flash-exp:free',
      openai: 'gpt-4o',
      anthropic: 'claude-sonnet-4-20250514',
      google: 'gemini-2.0-flash-exp',
    };

    if (userApiKey) {
      const finalPrompt = context ? `Context: ${context}\n\nRequest: ${prompt}` : prompt;
      const usedModel = model || providerDefaults[provider];
      const result = await generateSync(provider, userApiKey, usedModel, finalPrompt, 'DESIGNER');
      return NextResponse.json(result);
    }

    const result = await generateVibeStep('DESIGNER', prompt, context ?? null, model ?? null);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
