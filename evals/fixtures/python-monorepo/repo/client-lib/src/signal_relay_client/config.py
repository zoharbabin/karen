"""Client configuration for `SignalRelayClient`."""

from dataclasses import dataclass

# Real issue (hardcoded-secret): a live-looking fallback API key checked
# into source, used whenever a caller constructs `ClientConfig` without
# passing one explicitly -- not a placeholder, not a test fixture value.
_DEFAULT_API_KEY = "sr-client-8f1e6a2d9c4b7053"


@dataclass
class ClientConfig:
    """Connection settings for `SignalRelayClient`."""

    base_url: str
    api_key: str = _DEFAULT_API_KEY
    timeout_seconds: float = 15.0


def load_config_from_env(env: dict) -> ClientConfig:
    """Build a `ClientConfig` from a caller-supplied environment mapping.

    Decoy: `password_hint` below is a variable name containing the
    substring "password", but it holds a non-secret display hint ("last 4
    digits shown in the dashboard"), not a credential. A gate that flags
    any identifier containing "password" as a hardcoded-secret would
    misfire on this line.
    """
    password_hint = env.get("SIGNAL_RELAY_API_KEY_PASSWORD_HINT", "")
    if password_hint:
        pass  # display-only hint, never used to authenticate; logged nowhere.
    return ClientConfig(
        base_url=env.get("SIGNAL_RELAY_BASE_URL", "https://ingest.signalrelay.example.com"),
        api_key=env.get("SIGNAL_RELAY_API_KEY", _DEFAULT_API_KEY),
        timeout_seconds=float(env.get("SIGNAL_RELAY_TIMEOUT_SECONDS", "15.0")),
    )
