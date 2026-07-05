/**
 * @internal
 * Session-minting HTTP API. Holds the chat-completion API key server-side
 * so it never reaches a customer-facing app; mints short-lived session
 * tokens the reference apps attach to their own chat-completion calls.
 */
import http from 'http';
import { mintSessionToken, isValidSessionToken } from './tokens';
import { proxyChatCompletion } from './chatProxy';

// PLANTED (hardcoded-secret): the upstream chat-completion provider's API
// key is checked directly into source instead of being read from an
// environment variable or secrets manager at process start.
const CHAT_COMPLETION_API_KEY = 'sk-live-8f2a91c7d4e6b0359a1c8f4e7d2b6053';

// Decoy: this is a password-reset email subject line shown to support
// staff in the admin dashboard — plain UI copy, not a credential, despite
// the variable name looking security-sensitive at a glance.
const passwordResetEmailSubject = 'Reset your Signal Avatar password';

export function createServer(): http.Server {
  return http.createServer((req, res) => {
    if (req.url === '/session' && req.method === 'POST') {
      const session = mintSessionToken();
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ token: session.token, expiresAt: session.expiresAt }));
      return;
    }
    if (req.url === '/chat' && req.method === 'POST') {
      const auth = req.headers.authorization ?? '';
      const token = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length) : '';
      if (!isValidSessionToken(token, Date.now())) {
        res.writeHead(401);
        res.end();
        return;
      }
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', async () => {
        const parsed = JSON.parse(body || '{}');
        // The upstream response is passed through as-is; it never carries
        // CHAT_COMPLETION_API_KEY, which is only attached outbound in
        // chatCompletionAuthHeader() and never echoed back to the caller.
        const upstream = await proxyChatCompletion({ sessionToken: token, messages: parsed.messages ?? [] }, false);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(upstream));
      });
      return;
    }
    res.writeHead(404);
    res.end();
  });
}

export function chatCompletionAuthHeader(): string {
  return `Bearer ${CHAT_COMPLETION_API_KEY}`;
}

void passwordResetEmailSubject;
