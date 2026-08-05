# AI Tutor Chat Streaming Spec

> **Status:** Draft
> **Date:** 2026-08-05
> **Scope:** Revise the on-line AI tutor chat so both frontend and backend stream tokens in real time.

## 1. Problem

The AI tutor chat panel in `VideoPlayerView.vue` does not show tokens as they
are generated. The full assistant answer appears only after generation
completes (triggered by a trailing reactive change), so the UI reads as
"stuck / not streaming." The backend already streams correctly over SSE.

## 2. Current Architecture

```
frontend VideoPlayerView.sendChatMessage()
  └─ streamChat() (fetch + ReadableStream reader)   frontend/src/services/video.service.ts:17
      └─ POST /api/v1/chat                           backend/app/api/v1/endpoints/chat.py:19
          └─ chat_service.stream_chat()              backend/app/services/chat_service.py:76
              └─ llama_cpp.Llama.create_chat_completion(stream=True)
          └─ StreamingResponse(media_type="text/event-stream")   chat.py:68
```

### Backend (works)

- `chat.py` streams `data: {"token": "…", "done": false}\n\n` events.
- `chat_service.py` bridges the blocking llama-cpp generator into the async
  event loop via `loop.run_in_executor` (fix landed in commit `a49dd8e`).
- SSE headers set: `Cache-Control: no-cache`, `Connection: keep-alive`,
  `X-Accel-Buffering: no`.

No backend change is required for streaming to function.

### Frontend (broken)

`VideoPlayerView.vue:261-273`:

```ts
const assistantMessage: ChatMessage = { role: 'assistant', content: '' };
chatMessages.value.push(assistantMessage);
...
onToken: (token, done) => {
  if (!done) {
    assistantMessage.content += token;   // ← mutates RAW object
    scrollChatToBottom();
  }
},
```

`chatMessages` is `ref<ChatMessage[]>([])`. Pushing a plain object stores the
raw object in the reactive array. The local `assistantMessage` binding still
points at that raw object, so `assistantMessage.content += token` mutates the
raw object **through a non-reactive reference**. Vue's reactivity traps are on
the proxy, not the raw object, so no dependency fires and no re-render happens
per token. The DOM only updates on the next unrelated reactive change (e.g.
`isStreamingChat` flipping in `finally`).

The SSE parser in `video.service.ts:44-82` is correct (buffer-splits `\n`,
handles split events). The data arrives; the UI just never repaints it.

## 3. Root Cause

Vue 3 reactivity bypass: mutating the raw object that backs a reactive array
element, instead of the reactive proxy Vue returns when the array is indexed.

## 4. Target Behavior

- On send: assistant bubble appears immediately (empty, with pulsing cursor).
- On each `data: {"token": …}` event: bubble text appends that token and the
  container auto-scrolls. No wait for `done`.
- On `done`: streaming indicator stops; input re-enabled.
- On `error`: error surfaced; no partial-text loss.

## 5. Fix

In `VideoPlayerView.vue`, mutate through the reactive proxy. Two equivalent
options; the plan uses index-based lookup (no extra import):

```ts
const assistantIndex = chatMessages.value.length;
chatMessages.value.push({ role: 'assistant', content: '' });
...
onToken: (token, done) => {
  if (!done) {
    chatMessages.value[assistantIndex].content += token;
    scrollChatToBottom();
  }
},
```

`chatMessages.value[assistantIndex]` returns the reactive proxy, so `.content`
mutations trigger a re-render per token.

## 6. Non-Goals

- No WebSocket migration (SSE is one-way and sufficient — see
  `HowToTest.txt:158`).
- No change to the backend streaming path.
- No history persistence in this change.

## 7. Verification

- Backend: `curl -N -X POST http://localhost:8080/api/v1/chat …` shows tokens
  streaming (see `HowToTest.txt:93-96`).
- Frontend: send a chat message; assistant text grows token-by-token.
- `pnpm lint` and `pnpm build` pass.
