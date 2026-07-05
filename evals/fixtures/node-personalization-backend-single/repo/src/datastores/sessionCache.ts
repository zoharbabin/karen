// Decoy (unregistered-personal-data-store): keyed by userId and store-
// shaped like userTable.ts/eventStore.ts, but every value is a short-lived,
// opaque, random session token with a 15-minute TTL — no email, name, or
// other personal data lives here, and the token itself grants no identity
// information on its own. Structurally this is not a personal-data store,
// so it correctly never registers with consent/registry.ts.
class SessionCache {
  private tokens = new Map<string, { token: string; expiresAt: number }>();

  put(userId: string, token: string): void {
    this.tokens.set(userId, { token, expiresAt: Date.now() + 15 * 60_000 });
  }

  get(userId: string): string | undefined {
    const entry = this.tokens.get(userId);
    if (!entry || entry.expiresAt < Date.now()) return undefined;
    return entry.token;
  }
}

export const sessionCache = new SessionCache();
