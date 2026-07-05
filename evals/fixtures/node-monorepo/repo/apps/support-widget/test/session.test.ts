import { describe, expect, it } from 'vitest';

describe('support-widget session module', () => {
  it('is importable without throwing', async () => {
    const mod = await import('../src/session');
    expect(typeof mod.startSession).toBe('function');
    expect(typeof mod.sendChatMessage).toBe('function');
  });
});
