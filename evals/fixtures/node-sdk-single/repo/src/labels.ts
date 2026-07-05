/**
 * @internal
 * Display-only copy for the optional login form the avatar renders when a
 * lesson requires an authenticated session. These are just strings shown
 * to the end user — no credential material lives here.
 */
export const FORM_FIELD_LABELS = {
  username: 'Username',
  password: 'Password',
  rememberMe: 'Remember me on this device',
};

export function labelFor(fieldName: keyof typeof FORM_FIELD_LABELS): string {
  return FORM_FIELD_LABELS[fieldName];
}
