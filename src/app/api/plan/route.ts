import { NextResponse } from 'next/server';
import { generateVibeStep } from '@/lib/openrouter';

export async function POST(request: Request) {
  try {
    const { prompt, model } = await request.json();
    if (!prompt) return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    const clientApiKey = request.headers.get('x-api-key') || undefined;
    const result = await generateVibeStep('CEO', prompt, null, model ?? null, clientApiKey);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
