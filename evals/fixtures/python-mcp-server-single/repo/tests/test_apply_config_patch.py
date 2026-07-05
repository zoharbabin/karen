from incident_mcp_server.tools.apply_config_patch import handle_apply_config_patch


def test_merges_patch_keys():
    result = handle_apply_config_patch({"patch_yaml": "escalation_level: P1"})
    text = result["content"][0]["text"]
    assert "escalation_level" in text
