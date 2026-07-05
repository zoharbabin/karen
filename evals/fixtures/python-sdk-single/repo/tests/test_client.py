from prism_sdk.client import PrismClient


def test_client_uses_provided_base_url():
    client = PrismClient(api_key="test-key", base_url="https://internal.example.com/v1")
    assert client.base_url == "https://internal.example.com/v1"
    assert client.api_key == "test-key"
