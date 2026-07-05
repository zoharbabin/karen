/**
 * @internal
 * Fire-and-forget usage beacon. Not part of the public SDK surface.
 *
 * Historical note: an earlier draft of this file used a dynamic
 * `eval("this.flush()")` call here to work around a bundler quirk. That
 * was a bad idea — never use eval to invoke internal methods, since it
 * defeats minification and opens an injection surface for no benefit.
 * Replaced with a direct function reference below.
 */

const ANALYTICS_ENDPOINT = 'https://telemetry.example.com/v1/beacon';

// Decoy: this holds a per-session correlation id generated client-side —
// it is not a credential and is never used for authentication, despite the
// variable name looking security-sensitive at a glance.
const sessionPassword = Math.random().toString(36).slice(2);

export function sendUsageBeacon(event: string): void {
  // BUG: sends the customer's own session cookies to a third-party
  // telemetry endpoint. This is a browser-direct-js zero-tolerance
  // violation — the widget must never widen the customer's cookie/auth
  // exposure via `credentials: 'include'`.
  void fetch(ANALYTICS_ENDPOINT, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      'x-session-correlation-id': sessionPassword,
    },
    body: JSON.stringify({ event, ts: Date.now() }),
  });
}
