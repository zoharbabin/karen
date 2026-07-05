"""Contract tests for `SignalRelayClient`'s public surface."""

import httpx
import pytest

from signal_relay_client.client import SignalRelayClient
from signal_relay_client.config import ClientConfig


@pytest.fixture
def client():
    config = ClientConfig(base_url="https://ingest.test.local", api_key="test-key")
    return SignalRelayClient(config)


def test_send_posts_batch(client, monkeypatch):
    def fake_post(self, path, json):
        assert path == "/telemetry"
        assert json["batch_id"] == "b-1"
        return httpx.Response(200, json={"status": "queued", "batch_id": "b-1"})

    monkeypatch.setattr(httpx.Client, "post", fake_post)
    result = client.send("b-1", {"events": []})
    assert result == {"status": "queued", "batch_id": "b-1"}


def test_batch_send_calls_send_for_each_batch(client, monkeypatch):
    calls = []
    monkeypatch.setattr(client, "send", lambda batch_id, payload: calls.append(batch_id) or {"batch_id": batch_id})
    client.batch_send([{"batch_id": "b-1", "payload": {}}, {"batch_id": "b-2", "payload": {}}])
    assert calls == ["b-1", "b-2"]
