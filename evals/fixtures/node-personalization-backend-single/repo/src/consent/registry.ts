// The personal-data-store registry every store in this project must join
// (BLUEPRINT.md "Personal-Data Registry Pattern"). A data-subject export
// or erasure request walks REGISTERED_STORES to reach every store that
// has ever registered — a store that never calls register() is invisible
// to that walk, so an erasure request silently misses it.
export interface PersonalDataStore {
  name: string;
  exportUser(tenant: string, user: string): Promise<Record<string, unknown>>;
  eraseUser(tenant: string, user: string): Promise<void>;
}

const REGISTERED_STORES: PersonalDataStore[] = [];

export function register(store: PersonalDataStore): void {
  REGISTERED_STORES.push(store);
}

export async function exportDataSubject(tenant: string, user: string) {
  const results: Record<string, unknown> = {};
  for (const store of REGISTERED_STORES) {
    results[store.name] = await store.exportUser(tenant, user);
  }
  return results;
}

export async function eraseDataSubject(tenant: string, user: string) {
  for (const store of REGISTERED_STORES) {
    await store.eraseUser(tenant, user);
  }
}
