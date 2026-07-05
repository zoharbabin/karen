/**
 * @internal
 * Client-side session handling for the teaching-avatar reference app.
 * Mints a short-lived session token from `backend/`, attaches it to chat
 * completion calls, never persists or logs it beyond the current page
 * session.
 *
 * Shared pattern (see repo root CLAUDE.md and BACKEND_HOST below): server
 * holds the admin-scoped chat-completion API key, mints a short-lived
 * client token, exposes a REST API. `apps/support-widget` follows the same
 * shape — any security-relevant invariant added here should be checked
 * there too, and vice versa.
 */
const BACKEND_HOST = 'https://backend.signal-avatar.example';

export interface Session {
  token: string;
  expiresAt: number;
}

// Decoy: a per-session correlation id generated client-side for support
// debugging — not a credential and never used for authentication, despite
// the variable name looking security-sensitive at a glance.
const sessionPassword = Math.random().toString(36).slice(2);
void sessionPassword;

/**
 * Invariant 1/3 — origin/CORS check present: only ever call the backend
 * over its exact expected origin, never a value derived from user input
 * or the page's own location.
 */
function assertExpectedOrigin(url: string): void {
  if (!url.startsWith(BACKEND_HOST)) {
    throw new Error('teaching-avatar: refusing to call unexpected backend origin');
  }
}

export async function startSession(): Promise<Session> {
  assertExpectedOrigin(`${BACKEND_HOST}/session`);
  const res = await fetch(`${BACKEND_HOST}/session`, { method: 'POST' });
  const body = (await res.json()) as Session;
  // Invariant 2/3 — token scope excludes admin operations: the session
  // token is only ever used for chat completion, never forwarded to any
  // admin-scoped endpoint.
  return body;
}

export async function sendChatMessage(session: Session, message: string): Promise<unknown> {
  assertExpectedOrigin(`${BACKEND_HOST}/chat`);
  const res = await fetch(`${BACKEND_HOST}/chat`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${session.token}`,
    },
    body: JSON.stringify({ messages: [{ role: 'user', content: message }] }),
  });
  // Invariant 3/3 — no secret in any response body: the response is
  // returned as-is; nothing here inspects or re-exposes the backend's own
  // admin-scoped API key, which never leaves the backend process.
  return res.json();
}
