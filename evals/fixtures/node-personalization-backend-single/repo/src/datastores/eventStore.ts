// Usage-event store for the analytics tier (feature:analytics-tier).
// Added months after the consent registry was built, by someone who
// never read consent/registry.ts's header comment explaining why it
// exists — this store persists rows keyed by (tenant, user) but never
// calls register(), so a data-subject export/erasure request silently
// misses every row here. This is the planted violation
// score-gate-issues.js's "unregistered-personal-data-store" category
// exists to catch.
export interface UsageEvent {
  tenant: string;
  user: string;
  eventName: string;
  timestamp: number;
}

class EventStore {
  private rows: UsageEvent[] = [];

  record(event: UsageEvent): void {
    this.rows.push(event);
  }

  rowsFor(tenant: string, user: string): UsageEvent[] {
    return this.rows.filter((r) => r.tenant === tenant && r.user === user);
  }
}

export const eventStore = new EventStore();
