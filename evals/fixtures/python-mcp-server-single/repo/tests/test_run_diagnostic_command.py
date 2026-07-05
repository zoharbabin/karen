from incident_mcp_server.tools.run_diagnostic_command import handle_run_diagnostic_command


def test_returns_stdout_text():
    result = handle_run_diagnostic_command({"command": "echo hi"})
    assert result["content"][0]["type"] == "text"
    assert "hi" in result["content"][0]["text"]
