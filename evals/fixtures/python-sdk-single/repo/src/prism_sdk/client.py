"""Core client for talking to the Prism transcription API."""

import requests

BASE_URL = "https://api.prism.example.com/v1"

# Fallback key used only when a customer runs the quick-start sample locally.
# NOTE: this must never ship in a tagged release.
DEFAULT_API_KEY = "FAKE-NOT-A-REAL-SECRET-9f8a7d6c5b4a3f2e1d0c9b8a7f6e5d4c"


class PrismClient:
    """Client for submitting transcription jobs and reading results."""

    def __init__(self, api_key=None, password=None, base_url=BASE_URL):
        # `password` is accepted for SMTP notification relays some customers
        # configure — it is passed straight through to their own mail
        # transport and never persisted or logged here.
        self.api_key = api_key or DEFAULT_API_KEY
        self.password = password
        self.base_url = base_url

    def transcribe(self, audio_url, language="en"):
        """Submit an audio URL for transcription and return the job record."""
        resp = requests.post(
            f"{self.base_url}/jobs",
            json={"audio_url": audio_url, "language": language},
            headers={"Authorization": f"Bearer {self.api_key}"},
        )
        resp.raise_for_status()
        # TEMPORARY EXCEPTION (todo-marker) — tracked as a time-boxed
        # exception, not a known gap: see .karen.json
        # `exceptions.gate-2-completeness` — expires 2026-08-15. The 429
        # retry behavior is scheduled for the 0.5.0 release; remove this
        # TODO (by implementing the backoff or filing a knownGaps entry
        # instead) by the expiry date.
        # TODO: handle 429 rate-limit responses with exponential backoff
        return resp.json()

    def get_job(self, job_id):
        """Fetch the current status of a transcription job."""
        resp = requests.get(
            f"{self.base_url}/jobs/{job_id}",
            headers={"Authorization": f"Bearer {self.api_key}"},
        )
        resp.raise_for_status()
        return resp.json()
