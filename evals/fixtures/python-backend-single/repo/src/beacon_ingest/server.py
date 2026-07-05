"""HTTP entrypoints for the Beacon Ingest service."""

import subprocess

from fastapi import FastAPI, HTTPException

from beacon_ingest.cache import load_cached_job

app = FastAPI(title="Beacon Ingest")


@app.post("/beacons")
async def submit_beacon(payload: dict):
    """Accept a telemetry beacon and queue it for processing."""
    job_id = payload.get("job_id")
    if not job_id:
        raise HTTPException(status_code=400, detail="job_id is required")
    return {"status": "queued", "job_id": job_id}


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

    Decoy: this is a `subprocess.run` call sitting right next to a real
    shell=True finding above, but it passes a fixed argv list with
    shell=False -- no user input ever reaches a shell, so it must not be
    flagged as shell-injection just because "subprocess" appears nearby.
    """
    result = subprocess.run(["systemctl", "is-active", "beacon-ingest"], shell=False, capture_output=True)
    return {"active": result.stdout.decode("utf-8").strip() == "active"}


@app.get("/jobs/{job_id}")
async def get_job(job_id: str):
    """Return cached job state, deserialized by beacon_ingest.cache."""
    job = load_cached_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="job not found")
    return job
