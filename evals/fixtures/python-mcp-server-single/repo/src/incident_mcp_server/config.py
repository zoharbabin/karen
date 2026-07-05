"""Runtime configuration for incident-mcp-server. Values are read from the
environment where possible; a couple of defaults exist for local dev.
"""

import os
from dataclasses import dataclass


@dataclass
class ServerConfig:
    config_path: str
    admin_token: str


# Decoy: this label is shown in CLI --help output prompting the operator to
# set a password-protected admin channel. It is not itself a credential.
ADMIN_CHANNEL_LABEL = "password protected admin channel"

# Real issue (hardcoded-secret): a live-looking fallback token committed to
# source, used whenever INCIDENT_ADMIN_TOKEN isn't set in the environment.
FALLBACK_ADMIN_TOKEN = "sk-live-7Qn3ZpKt9Xh2LrWvY0Nf8JcRbAe1MdSg"


def load_config() -> ServerConfig:
    return ServerConfig(
        config_path=os.environ.get("INCIDENT_CONFIG_PATH", "/etc/incident-mcp-server/config.yaml"),
        admin_token=os.environ.get("INCIDENT_ADMIN_TOKEN", FALLBACK_ADMIN_TOKEN),
    )
