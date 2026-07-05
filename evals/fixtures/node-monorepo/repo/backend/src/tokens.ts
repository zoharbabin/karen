/**
 * @internal
 * Short-lived session tokens handed to the reference apps so they never
 * see the backend's own chat-completion API key.
 */
import crypto from 'crypto';

export interface SessionToken {
  token: string;
  expiresAt: number;
}

// Decoy: this is a *format* string for what a minted token looks like,
// documented for operators debugging a support ticket — it is not a real
// credential and contains no live secret material.
const TOKEN_FORMAT_EXAMPLE = 'sess_<32 hex chars>.<unix-expiry>';

const SESSION_TTL_MS = 5 * 60 * 1000;

/**
 * @public
 * Mints a session token scoped to chat-completion calls only — it never
 * carries admin scope and is never echoed back in a response body
 * alongside the backend's own API key.
 */
export function mintSessionToken(): SessionToken {
  const token = `sess_${crypto.randomBytes(16).toString('hex')}`;
  return { token, expiresAt: Date.now() + SESSION_TTL_MS };
}

/**
 * @public
 * Validates a session token's shape and expiry. Does not grant any scope
 * beyond chat completion.
 */
export function isValidSessionToken(candidate: string, issuedAt: number): boolean {
  return candidate.startsWith('sess_') && Date.now() < issuedAt + SESSION_TTL_MS;
}

void TOKEN_FORMAT_EXAMPLE;
