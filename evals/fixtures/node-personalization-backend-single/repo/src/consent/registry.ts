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

// Real issue (unannotated-intentional-duplication): near-identical export-
// manifest formatting copy-pasted for two jurisdictions, with no
// `karen-intentional-duplicate` marker recording whether the duplication is
// deliberate. A future edit to one (e.g. adding a required disclosure field)
// has no signal telling the editor whether the other manifest needs the
// same change or must stay different — the ambiguity itself is the defect.
export function formatExportManifestGDPR(data: Record<string, unknown>): string {
  return JSON.stringify({ jurisdiction: 'GDPR', data, generatedAt: Date.now() });
}

export function formatExportManifestCCPA(data: Record<string, unknown>): string {
  return JSON.stringify({ jurisdiction: 'CCPA', data, generatedAt: Date.now() });
}

// Decoy (unannotated-intentional-duplication): also two near-identical
// per-jurisdiction functions, but this pair carries a
// karen-intentional-duplicate marker recording *why* they're kept separate
// — CCPA carves out a financial-records retention exception GDPR does not
// have, so a future edit adding that exception only to CCPA is expected,
// not a drift bug. Structurally identical today, but correctly not flagged.
// karen-intentional-duplicate: GDPR and CCPA erasure eligibility must vary
// independently — CCPA's financial-records retention exception does not
// exist under GDPR; merging these would silently apply one regime's
// exception to the other.
export function isErasureEligibleGDPR(hasLegalHold: boolean, hasFinancialRecordsHold: boolean): boolean {
  if (hasLegalHold) return false;
  if (hasFinancialRecordsHold) return false;
  return true;
}

export function isErasureEligibleCCPA(hasLegalHold: boolean, hasFinancialRecordsHold: boolean): boolean {
  if (hasLegalHold) return false;
  if (hasFinancialRecordsHold) return false;
  return true;
}
