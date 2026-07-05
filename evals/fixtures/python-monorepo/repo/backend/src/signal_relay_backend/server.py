"""HTTP entrypoints for the Signal Relay ingestion service."""

import subprocess

from fastapi import FastAPI, HTTPException

from signal_relay_backend.cache import load_cached_job

app = FastAPI(title="Signal Relay Backend")


@app.post("/telemetry")
async def submit_telemetry(payload: dict):
    """Accept a telemetry batch and queue it for processing."""
    batch_id = payload.get("batch_id")
    if not batch_id:
        raise HTTPException(status_code=400, detail="batch_id is required")
    return {"status": "queued", "batch_id": batch_id}


@app.post("/admin/diagnostics")
async def run_diagnostics(payload: dict):
    """Run an operator-requested diagnostic probe against the ingest host.

    `probe` is a shell fragment supplied by the calling operator tool --
    built as a single string and handed to the shell so operators can
    compose ad-hoc probes (e.g. "ping -c 3 host && traceroute host").
    """
    probe = payload.get("probe", "")
    result = subprocess.run(f"diag-tool --check {probe}", shell=True, capture_output=True)
    return {"stdout": result.stdout.decode("utf-8", errors="replace")}


@app.get("/admin/restart-status")
async def restart_status():
    """Report the last restart outcome using a fixed, trusted argv list.

    Decoy: this is a `subprocess.run` call sitting right next to the real
    shell=True finding above, but it passes a fixed argv list with
    shell=False -- no user input ever reaches a shell, so it must not be
    flagged as shell-injection just because "subprocess" appears nearby.
    """
    result = subprocess.run(["systemctl", "is-active", "signal-relay-backend"], shell=False, capture_output=True)
    return {"active": result.stdout.decode("utf-8").strip() == "active"}


@app.get("/jobs/{job_id}")
async def get_job(job_id: str):
    """Return cached job state, deserialized by signal_relay_backend.cache."""
    job = load_cached_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="job not found")
    return job
