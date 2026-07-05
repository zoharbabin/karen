from prism_sdk.config import load_config_safe


def test_load_config_safe_parses_plain_scalars(tmp_path):
    config_path = tmp_path / "prism.yaml"
    config_path.write_text("base_url: https://api.prism.example.com/v1\n")
    config = load_config_safe(str(config_path))
    assert config["base_url"] == "https://api.prism.example.com/v1"
