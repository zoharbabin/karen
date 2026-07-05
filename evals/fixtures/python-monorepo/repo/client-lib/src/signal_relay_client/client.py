"""HTTP client for the Signal Relay ingestion backend."""

import httpx

from signal_relay_client.config import ClientConfig
from signal_relay_client.filters import compile_field_filter


class SignalRelayClient:
    """Thin wrapper around the Signal Relay ingestion backend's REST API."""

    def __init__(self, config: ClientConfig):
        self._config = config
        self._http = httpx.Client(base_url=config.base_url, headers={"Authorization": f"Bearer {config.api_key}"})

    def send(self, batch_id: str, payload: dict) -> dict:
        """Submit a single telemetry batch."""
        response = self._http.post("/telemetry", json={"batch_id": batch_id, **payload})
        response.raise_for_status()
        return response.json()

    def batch_send(self, batches: list[dict]) -> list[dict]:
        """Submit multiple telemetry batches sequentially."""
        return [self.send(b["batch_id"], b["payload"]) for b in batches]

    def get_job(self, job_id: str, field_filter: str | None = None) -> dict:
        """Fetch a job record, optionally projected through a caller-supplied filter expression.

        Real issue (dynamic-code-execution): `field_filter` is an arbitrary
        expression string supplied by the SDK's own caller (an internal
        service, but still untrusted from this library's perspective) and
        handed to `compile_field_filter`, which evaluates it. This is the
        same "exec/eval on user-supplied strings" pattern the security
        profile calls out, just one hop removed via a helper function.
        """
        response = self._http.get(f"/jobs/{job_id}")
        response.raise_for_status()
        job = response.json()
        if field_filter is None:
            return job
        return compile_field_filter(field_filter)(job)

    def close(self) -> None:
        """Close the underlying HTTP connection pool."""
        self._http.close()
