"""Playwright E2E fixtures for beacon-ingest.

This suite boots the real FastAPI app behind a live uvicorn server and
drives it over real HTTP with Playwright's APIRequestContext -- there is no
in-process TestClient shortcut here, and no unit-level import of
`beacon_ingest.cache` / `.config` in isolation anywhere in this repo. That's
deliberate: this is the E2E-only test suite the fixture is meant to stress
(BLUEPRINT.md's "E2E-only test suites... typically produce no function-level
coverage" branch), not an oversight to be "fixed" by adding unit tests.
"""

import socket
import subprocess
import sys
import time

import pytest
from playwright.sync_api import sync_playwright


def _free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


@pytest.fixture(scope="session")
def live_server():
    """Boot beacon_ingest.server:app with uvicorn as a real subprocess."""
    port = _free_port()
    proc = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "beacon_ingest.server:app",
            "--host",
            "127.0.0.1",
            "--port",
            str(port),
        ],
    )
    base_url = f"http://127.0.0.1:{port}"
    try:
        for _ in range(50):
            try:
                with socket.create_connection(("127.0.0.1", port), timeout=0.2):
                    break
            except OSError:
                time.sleep(0.1)
        else:
            raise RuntimeError("beacon-ingest server did not start in time")
        yield base_url
    finally:
        proc.terminate()
        proc.wait(timeout=5)


@pytest.fixture(scope="session")
def api_request_context(live_server):
    with sync_playwright() as playwright:
        request_context = playwright.request.new_context(base_url=live_server)
        yield request_context
        request_context.dispose()
