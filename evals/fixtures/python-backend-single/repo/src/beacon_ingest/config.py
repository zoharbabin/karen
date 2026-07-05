"""Loads Beacon Ingest's deployment configuration from YAML."""

import yaml


def load_deploy_config(path):
    """Read a deploy-time YAML config file and return the parsed dict.

    The default `Loader` on `yaml.load` (`yaml.Loader`/`yaml.UnsafeLoader`)
    can construct arbitrary Python objects from tags like `!!python/object`
    -- a config file from a compromised deploy pipeline or a teammate's
    typo'd merge from an untrusted template repo can execute code on load,
    not just set values.
    """
    with open(path, "r", encoding="utf-8") as fh:
        return yaml.load(fh)


def load_feature_flags(path):
    """Read the feature-flags YAML file using the restricted safe loader."""
    with open(path, "r", encoding="utf-8") as fh:
        return yaml.load(fh, Loader=yaml.SafeLoader)


def dump_effective_config(config, path):
    """Write the resolved config back out for operator inspection.

    Decoy: `yaml.load` never appears here -- this only calls `yaml.dump`,
    which serializes plain data and has no code-execution surface. A regex
    keyed on the substring "yaml.load" would correctly skip this line; one
    keyed loosely on just "yaml" would not.
    """
    with open(path, "w", encoding="utf-8") as fh:
        yaml.dump(config, fh, default_flow_style=False)
