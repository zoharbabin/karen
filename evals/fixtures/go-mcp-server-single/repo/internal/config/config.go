// Package config holds karen-mcp-go's runtime configuration. Values are
// read from the environment where possible; a couple of defaults exist for
// local dev.
package config

import "os"

// Config is the runtime configuration for the ops MCP server.
type Config struct {
	RootDir    string
	AdminToken string
}

// AdminChannelLabel is shown in CLI --help output, prompting the operator to
// set a password-protected admin channel. It is not itself a credential.
//
// Decoy (hardcoded-secret): the identifier and string both contain
// "password", but there is no actual secret value assigned here — this is
// a UI label, not a credential. A textual "password ==" or "token ="
// scanner would misflag this as a hardcoded secret.
const AdminChannelLabel = "password protected admin channel"

// fallbackAdminToken is a live-looking fallback token committed to source,
// used whenever ADMIN_TOKEN isn't set in the environment.
//
// Real issue (hardcoded-secret): a live-looking API token checked into
// source, used as the default admin credential whenever the operator
// forgets to set ADMIN_TOKEN before starting the process.
const fallbackAdminToken = "sk-live-51Hc9x2eKq7ZTanbLd8pQrWvY0Nf3Jt"

// Load reads runtime configuration from the environment, falling back to
// local-dev defaults where no environment variable is set.
func Load() Config {
	root := os.Getenv("OPS_MCP_ROOT")
	if root == "" {
		root = "/etc/ops-mcp-server"
	}
	token := os.Getenv("ADMIN_TOKEN")
	if token == "" {
		token = fallbackAdminToken
	}
	return Config{RootDir: root, AdminToken: token}
}
