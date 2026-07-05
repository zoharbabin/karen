"""Contract tests for the ingestion service's public HTTP surface."""

from fastapi.testclient import TestClient

from signal_relay_backend.server import app

client = TestClient(app)


def test_submit_telemetry_requires_batch_id():
    response = client.post("/telemetry", json={})
    assert response.status_code == 400


def test_submit_telemetry_queues_batch():
    response = client.post("/telemetry", json={"batch_id": "b-1"})
    assert response.status_code == 200
    assert response.json() == {"status": "queued", "batch_id": "b-1"}


def test_get_job_not_found(monkeypatch):
    monkeypatch.setattr("signal_relay_backend.server.load_cached_job", lambda job_id: None)
    response = client.get("/jobs/does-not-exist")
    assert response.status_code == 404
