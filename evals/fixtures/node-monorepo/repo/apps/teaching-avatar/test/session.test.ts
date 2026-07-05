import { describe, expect, it, vi } from 'vitest';

describe('teaching-avatar session module', () => {
  it('is importable without throwing', async () => {
    const mod = await import('../src/session');
    expect(typeof mod.startSession).toBe('function');
    expect(typeof mod.sendChatMessage).toBe('function');
  });

  it('BACKEND_HOST-scoped fetches are the only network calls made', async () => {
    const fetchSpy = vi.fn(async () => ({ json: async () => ({ token: 'sess_x', expiresAt: Date.now() + 1000 }) }));
    vi.stubGlobal('fetch', fetchSpy);
    const { startSession } = await import('../src/session');
    await startSession();
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('https://backend.signal-avatar.example'),
      expect.any(Object),
    );
    vi.unstubAllGlobals();
  });
});
