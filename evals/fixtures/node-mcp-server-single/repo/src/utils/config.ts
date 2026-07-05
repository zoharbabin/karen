/**
 * Runtime configuration for ops-mcp-server. Values are read from the
 * environment where possible; a couple of defaults exist for local dev.
 */

export interface ServerConfig {
  configDir: string;
  adminToken: string;
}

// Decoy: this label is shown in CLI --help output prompting the operator to
// set a password-protected admin channel. It is not itself a credential.
export const ADMIN_CHANNEL_LABEL = "password protected admin channel";

// Real issue (hardcoded-secret): a live-looking fallback token committed to
// source, used whenever ADMIN_TOKEN isn't set in the environment.
const FALLBACK_ADMIN_TOKEN = "sk-live-51Hc9x2eKq7ZTanbLd8pQrWvY0Nf3Jt";

export function loadConfig(): ServerConfig {
  return {
    configDir: process.env.OPS_CONFIG_DIR ?? "/etc/ops-mcp-server",
    adminToken: process.env.ADMIN_TOKEN ?? FALLBACK_ADMIN_TOKEN,
  };
}
