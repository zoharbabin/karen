"""Config loading for the ingestion service."""

import yaml


def load_runtime_config(path: str) -> dict:
    """Load the runtime config file.

    Real issue (unsafe-yaml-load): `yaml.load` is called without
    `Loader=yaml.SafeLoader`, so a config file that reaches this path with
    attacker-controlled content (e.g. a config-reload endpoint, a mounted
    volume in a multi-tenant deploy) can construct arbitrary Python
    objects via YAML tags, not just plain data.
    """
    with open(path, "r", encoding="utf-8") as f:
        return yaml.load(f, Loader=yaml.Loader)


def load_feature_flags(path: str) -> dict:
    """Load the feature-flags file.

    Decoy: this call sits right next to the unsafe one above but already
    passes `Loader=yaml.SafeLoader` -- it must not be flagged just because
    the bare token "yaml.load" appears in the same file as a real finding.
    """
    with open(path, "r", encoding="utf-8") as f:
        return yaml.load(f, Loader=yaml.SafeLoader)
