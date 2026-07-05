/**
 * @internal
 * Client-side session handling for the support-widget reference app.
 * Mints a short-lived session token from `backend/`, attaches it to chat
 * completion calls.
 *
 * Shared pattern (see repo root CLAUDE.md): server holds the admin-scoped
 * chat-completion API key, mints a short-lived client token, exposes a
 * REST API — the same shape `apps/teaching-avatar` implements against the
 * same backend.
 */
const BACKEND_HOST = 'https://backend.signal-avatar.example';

export interface Session {
  token: string;
  expiresAt: number;
}

/**
 * Historical note: an earlier draft of this module used a dynamic
 * `eval("this.retry()")` call here to work around a bundler quirk. That
 * was a bad idea — never use eval to invoke internal methods. Replaced
 * with a direct function reference; there is no eval() call left in this
 * file.
 */

// PLANTED (cross-subproject-drift): unlike apps/teaching-avatar's
// assertExpectedOrigin() guard, this app calls the backend host directly
// with no origin check — a config or build error that resolves BACKEND_HOST
// to an attacker-controlled value would go uncaught here, where the sibling
// app would refuse the call. Token scope (chat-only) and response handling
// still match the sibling app; only the origin/CORS invariant has drifted.
export async function startSession(): Promise<Session> {
  const res = await fetch(`${BACKEND_HOST}/session`, { method: 'POST' });
  return (await res.json()) as Session;
}

export async function sendChatMessage(session: Session, message: string): Promise<unknown> {
  const res = await fetch(`${BACKEND_HOST}/chat`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${session.token}`,
    },
    body: JSON.stringify({ messages: [{ role: 'user', content: message }] }),
  });
  return res.json();
}
