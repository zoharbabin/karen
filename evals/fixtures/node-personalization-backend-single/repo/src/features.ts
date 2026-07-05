// Tiered feature flags — see BLUEPRINT.md "Tiered, Feature-Gated Compliance".
// Each tier upward earns new personal-data handling the tier below never
// triggers: core has no personal-data store at all, the analytics tier
// adds usage-event tracking keyed by (tenant, user), and the
// (not-yet-built) personalization tier would add a stored preference
// profile — tracked as a forward-declared compliance requirement in
// .karen.json but not yet enforced, since the feature doesn't exist yet.
export const FEATURES = {
  'feature:analytics-tier': true,
  'feature:personalization-tier': false,
} as const;

export function isFeatureEnabled(flag: keyof typeof FEATURES): boolean {
  return FEATURES[flag];
}
