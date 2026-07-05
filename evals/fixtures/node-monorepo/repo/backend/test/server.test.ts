import { describe, expect, it } from 'vitest';
import { mintSessionToken, isValidSessionToken } from '../src/tokens';

describe('mintSessionToken', () => {
  it('produces a token with the expected prefix', () => {
    const session = mintSessionToken();
    expect(session.token.startsWith('sess_')).toBe(true);
  });

  it('sets an expiry in the future', () => {
    const session = mintSessionToken();
    expect(session.expiresAt).toBeGreaterThan(Date.now());
  });
});

describe('isValidSessionToken', () => {
  it('accepts a freshly issued token', () => {
    expect(isValidSessionToken('sess_abc123', Date.now())).toBe(true);
  });

  it('rejects a malformed token', () => {
    expect(isValidSessionToken('bogus_abc123', Date.now())).toBe(false);
  });
});
