import { generateVibeCodeStream } from '@/lib/openrouter';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { prompt, error, model } = await request.json();
    if (!prompt && !error) {
      return NextResponse.json({ error: 'Prompt or error is required' }, { status: 400 });
    }

    const clientApiKey = request.headers.get('x-api-key') || undefined;
    const { stream, model: usedModel } = await generateVibeCodeStream(prompt || '', error || null, model ?? null, clientApiKey);

    // Return the stream directly with appropriate headers
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