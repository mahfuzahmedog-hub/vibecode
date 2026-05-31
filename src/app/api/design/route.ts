import { NextResponse } from 'next/server';
import { generateVibeStep } from '@/lib/openrouter';
import { designSchema } from '@/lib/validation';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = designSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid request' }, { status: 400 });
    }

    const { prompt, context, model } = parsed.data;
    const clientApiKey = request.headers.get('x-api-key') || undefined;
    const result = await generateVibeStep('DESIGNER', prompt, context ?? null, model ?? null, clientApiKey);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
