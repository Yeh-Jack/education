import { describe, it, expect, vi } from 'vitest';

import { streamChat, type StreamChatOptions } from '../video.service';

(globalThis as any).window = (globalThis as any).window ?? {};

function sseResponse(events: string[]): Response {
  const encoder = new TextEncoder();
  let body = events.map((e) => `data: ${e}\n\n`).join('');
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const bytes = encoder.encode(body);
      const mid = Math.floor(bytes.length / 2);
      controller.enqueue(bytes.slice(0, mid));
      controller.enqueue(bytes.slice(mid));
      controller.close();
    },
  });
  return new Response(stream, { status: 200 });
}

describe('streamChat SSE parsing', () => {
  it('accumulates tokens in order and stops on done', async () => {
    const chunks: string[] = [];
    const events = [
      JSON.stringify({ token: 'He', done: false }),
      JSON.stringify({ token: 'llo', done: false }),
      JSON.stringify({ token: '', done: true }),
    ];
    const originalFetch = globalThis.fetch;
    (globalThis.fetch as any) = vi.fn().mockResolvedValue(sseResponse(events));

    const opts: StreamChatOptions = {
      messages: [{ role: 'user', content: 'hi' }],
      onToken: (token, done) => { if (!done) chunks.push(token); },
    };
    await streamChat(opts);

    expect(chunks).toEqual(['He', 'llo']);
    (globalThis.fetch as any) = originalFetch;
  });

  it('calls onError when the server reports an error event', async () => {
    const onError = vi.fn();
    (globalThis.fetch as any) = vi.fn().mockResolvedValue(
      sseResponse([JSON.stringify({ error: 'boom' })])
    );

    const opts: StreamChatOptions = {
      messages: [{ role: 'user', content: 'hi' }],
      onError,
    };
    await streamChat(opts);

    expect(onError).toHaveBeenCalledWith(new Error('boom'));
  });
});
