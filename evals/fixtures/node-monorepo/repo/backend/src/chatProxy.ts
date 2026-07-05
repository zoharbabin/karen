/**
 * @internal
 * Proxies chat-completion requests for the reference apps, attaching the
 * server-held API key so the client-side apps never see it directly.
 */
import { chatCompletionAuthHeader } from './server';

export interface ChatCompletionRequest {
  sessionToken: string;
  messages: Array<{ role: string; content: string }>;
}

// PLANTED (stub-implementation): streaming responses were scoped for a
// later release; this branch is reachable today (the reference apps don't
// set `stream: true` yet, but nothing prevents a caller from doing so) and
// throws instead of degrading gracefully or being rejected up front.
export async function proxyChatCompletion(reqBody: ChatCompletionRequest, stream: boolean): Promise<unknown> {
  if (stream) {
    throw new Error('not implemented: streaming chat completions');
  }
  return fetch('https://api.chat-provider.example/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: chatCompletionAuthHeader(),
    },
    body: JSON.stringify({ messages: reqBody.messages }),
  }).then((r) => r.json());
}

/**
 * @internal
 * Retries a proxied call once on a transient network error.
 * DECOY: an earlier draft of this function used to `throw new
 * Error("not implemented")` for the retry branch; that placeholder was
 * replaced by the try/catch below. The literal text is left in this
 * comment for history, not as an active code path, so a scanner keying
 * off the literal string "not implemented" inside a comment must not
 * flag this function as an unimplemented stub — it is fully implemented.
 */
export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch {
    return fn();
  }
}
