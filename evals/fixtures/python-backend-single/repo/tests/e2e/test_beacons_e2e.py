"""End-to-end coverage of the beacon-ingest HTTP surface.

Every test here drives the live server over real HTTP through Playwright's
APIRequestContext (see conftest.py). Nothing imports beacon_ingest.cache or
beacon_ingest.config directly, so there is no function-level coverage number
for this repo -- only these black-box request/response assertions.
"""


def test_submit_beacon_returns_queued(api_request_context):
    response = api_request_context.post(
        "/beacons", data={"job_id": "beacon-e2e-1"}
    )
    assert response.status == 200
    body = response.json()
    assert body["status"] == "queued"
    assert body["job_id"] == "beacon-e2e-1"


def test_submit_beacon_without_job_id_is_rejected(api_request_context):
    response = api_request_context.post("/beacons", data={})
    assert response.status == 400


def test_get_unknown_job_returns_404(api_request_context):
    response = api_request_context.get("/jobs/does-not-exist")
    assert response.status == 404


def test_restart_status_reports_a_boolean_active_flag(api_request_context):
    response = api_request_context.get("/admin/restart-status")
    assert response.status == 200
    assert isinstance(response.json()["active"], bool)
