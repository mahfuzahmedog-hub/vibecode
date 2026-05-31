import { NextResponse } from 'next/server';
import { generateVibeStep } from '@/lib/openrouter';
import { generateSync, type AIProvider } from '@/lib/ai-client';
import { planSchema } from '@/lib/validation';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = planSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid request' }, { status: 400 });
    }

    const { prompt, model } = parsed.data;
    const userApiKey = request.headers.get('x-api-key') || undefined;
    const provider = (request.headers.get('x-api-provider') || 'openrouter') as AIProvider;

    const providerDefaults: Record<AIProvider, string> = {
      openrouter: 'google/gemini-2.0-flash-exp:free',
      openai: 'gpt-4o',
      anthropic: 'claude-sonnet-4-20250514',
      google: 'gemini-2.0-flash-exp',
    };

    if (userApiKey) {
      const usedModel = model || providerDefaults[provider];
      const result = await generateSync(provider, userApiKey, usedModel, prompt, 'CEO');
      return NextResponse.json(result);
    }

    const result = await generateVibeStep('CEO', prompt, null, model ?? null);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
