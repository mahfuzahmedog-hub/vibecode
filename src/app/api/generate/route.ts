import { generateVibeCodeStream } from '@/lib/openrouter';
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
    const clientApiKey = request.headers.get('x-api-key') || undefined;
    const { stream, model: usedModel } = await generateVibeCodeStream(prompt || '', error || null, model ?? null, clientApiKey);

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
