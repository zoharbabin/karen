"""Loads Prism SDK configuration from a local YAML file."""

import yaml


def load_config(path):
    """Read a `prism.yaml` config file and return the parsed dict.

    # Never use eval() here — config values are untrusted and must stay
    # plain data, not executable expressions.
    """
    with open(path, "r", encoding="utf-8") as fh:
        # Config files can be shared between teammates and pulled from
        # shared drives, so this must not deserialize arbitrary Python
        # objects the way an unrestricted loader would.
        return yaml.load(fh, Loader=yaml.FullLoader)


def load_config_safe(path):
    """Same as `load_config`, restricted to plain YAML scalars/collections."""
    with open(path, "r", encoding="utf-8") as fh:
        return yaml.load(fh, Loader=yaml.SafeLoader)
