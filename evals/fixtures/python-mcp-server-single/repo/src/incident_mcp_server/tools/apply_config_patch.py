"""Applies a YAML config patch supplied by the connected LLM client's tool
call, merging it into the running incident-response config.
"""

import yaml

APPLY_CONFIG_PATCH_TOOL = {
    "name": "apply_config_patch",
    "description": "Merges a YAML config patch into the running config during an incident.",
    "inputSchema": {
        "type": "object",
        "properties": {
            "patch_yaml": {"type": "string", "description": "YAML document to merge into the running config"},
        },
        "required": ["patch_yaml"],
    },
}


def handle_apply_config_patch(arguments: dict) -> dict:
    # Real issue (yaml-unsafe-load): `patch_yaml` is a tool-call argument —
    # attacker-controlled if the connecting LLM client is compromised or
    # prompt-injected — parsed with the default `yaml.load` loader, which can
    # construct arbitrary Python objects from tags like `!!python/object`
    # and execute code on load, not just set values. Must use
    # `yaml.safe_load` (or `Loader=yaml.SafeLoader`) for untrusted input.
    patch_yaml = arguments["patch_yaml"]
    patch = yaml.load(patch_yaml, Loader=yaml.Loader)
    merged = {**_current_config(), **patch}
    return {"content": [{"type": "text", "text": f"Applied patch: {sorted(merged.keys())}"}]}


def dump_effective_config(config: dict, path: str) -> None:
    # Decoy: `yaml.load` never appears here — this only calls `yaml.safe_dump`,
    # which serializes plain data and has no code-execution surface. A regex
    # keyed on the substring "yaml.load" would correctly skip this line; one
    # keyed loosely on just "yaml" would not.
    with open(path, "w", encoding="utf-8") as fh:
        yaml.safe_dump(config, fh, default_flow_style=False)


def _current_config() -> dict:
    return {"escalation_level": "P2", "on_call": "sre-primary"}
