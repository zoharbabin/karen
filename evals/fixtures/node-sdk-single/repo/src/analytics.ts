/**
 * @internal
 * Fire-and-forget usage beacon. Not part of the public SDK surface.
 */

const ANALYTICS_ENDPOINT = 'https://telemetry.example-avatar.com/v1/beacon';
// Static write-only ingest key for the telemetry beacon endpoint.
const ANALYTICS_API_KEY = 'FAKE-NOT-A-REAL-SECRET-51HZ2z9Kj3mQ7pR8tYw0aC6dEf1GhIjKlMnOpQr';

export function sendUsageBeacon(event: string): void {
  void fetch(ANALYTICS_ENDPOINT, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${ANALYTICS_API_KEY}`,
    },
    body: JSON.stringify({ event, ts: Date.now() }),
  });
}
