# Chat Streaming Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the AI tutor chat in the Vue frontend stream tokens in real time to match the already-working SSE backend.

**Architecture:** One-line frontend fix in `VideoPlayerView.vue`. The backend already streams SSE correctly (`chat.py` + `chat_service.py`, commit `a49dd8e`); no backend change. The bug is Vue 3 reactivity bypass: `onToken` mutates the raw `assistantMessage` object pushed into `chatMessages.value` instead of the reactive proxy, so no re-render fires per token.

**Tech Stack:** Vue 3.5 Composition API, TypeScript, Vite, Vitest (test script exists; no frontend test infra for components yet).

**Spec:** `docs/superpowers/specs/2026-08-05-chat-streaming-spec.md`

## Global Constraints

- No new dependencies (SSE is one-way and sufficient — no WebSocket).
- No backend changes.
- Single-user app, no auth.
- Follow existing code style: `<script setup>`, strict TS.
- Commits per task; commit messages in repo style (`git log --oneline`).

---

### Task 1: Mutate the assistant message through the reactive proxy

**Files:**
- Modify: `frontend/src/views/VideoPlayerView.vue:261-273`
- Test: `frontend/src/services/__tests__/streamChat.spec.ts` (new, SSE parser regression guard)

**Interfaces:**
- Consumes: `streamChat()` from `frontend/src/services/video.service.ts:17` (signature `streamChat(options: StreamChatOptions): Promise<void>`)
- Produces: chat bubble appending tokens reactively; no signature changes.

- [ ] **Step 1: Write the failing frontend test**

Create `frontend/src/services/__tests__/streamChat.spec.ts` — a regression test that `streamChat` parses SSE events correctly, including a token split across two chunks (the parser is the only pure-logic unit testable without a component harness):

```ts
import { describe, it, expect, vi } from 'vitest';

import { streamChat, type StreamChatOptions } from '../video.service';

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
```

- [ ] **Step 2: Run test to verify it fails or is skipped**

Run: `cd frontend && pnpm test --run`
Expected: PASS (parser is already correct — this is a regression guard, not a red-green test; the actual fix is validated in Steps 5-6). If `vitest` is not yet configured with a test `environment`, keep the default `node` — the tests above need only `ReadableStream`/`Response`, both available in Node 18+.

- [ ] **Step 3: Apply the fix in `VideoPlayerView.vue`**

Replace lines 261-273. Before:

```ts
  const assistantMessage: ChatMessage = { role: 'assistant', content: '' };
  chatMessages.value.push(assistantMessage);
```

After — capture the index, push, then mutate through the reactive proxy:

```ts
  const assistantIndex = chatMessages.value.length;
  chatMessages.value.push({ role: 'assistant', content: '' });
```

And inside `onToken`, replace:

```ts
        if (!done) {
          assistantMessage.content += token;
          scrollChatToBottom();
        }
```

with:

```ts
        if (!done) {
          chatMessages.value[assistantIndex].content += token;
          scrollChatToBottom();
        }
```

- [ ] **Step 4: Run frontend checks**

Run: `cd frontend && pnpm lint && pnpm build`
Expected: no lint errors, `vue-tsc` typecheck passes (`pnpm build` runs `vue-tsc && vite build`).

- [ ] **Step 5: Manually verify streaming in the browser**

1. Start backend + frontend (docker-compose or `uv run uvicorn` + `pnpm dev`).
2. Open a video page, open the AI Tutor chat, send a message.
3. Expected: assistant bubble appears immediately with a pulsing cursor and text grows token-by-token; the message box is disabled until `done`.
4. Also verify via curl that the backend still streams: `curl -N -X POST http://localhost:8080/api/v1/chat` with a JSON body per `HowToTest.txt:93-96`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/views/VideoPlayerView.vue frontend/src/services/__tests__/streamChat.spec.ts docs/superpowers/specs/2026-08-05-chat-streaming-spec.md
git commit -m "Fix AI tutor chat not streaming in the frontend"
```

---

## Self-Review

**1. Spec coverage:** The spec's single root cause (raw-object mutation) is fixed in Task 1 Step 3; parser regression guard (Step 1-2) covers the "data arrives" half; manual verification (Step 5) covers end-to-end behavior. Non-goals honored (no backend change, no WebSocket).

**2. Placeholder scan:** No TBD/TODO; all steps contain concrete code and commands.

**3. Type consistency:** `assistantIndex: number` matches `chatMessages.value.length` typing; `streamChat` options types match the existing exported interfaces in `video.service.ts`.
