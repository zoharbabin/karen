## Answers
Q: what does this project do / who uses it?
A: "It's a Go backend service — notification-dispatcher. Accepts internal notification-send requests and relays each one to a subscriber's registered webhook. Used internally, not customer-facing."

Q: what's your deployment/runtime environment?
A: "Runs as a standalone HTTP service, listens on :8090. No browser context, no CDN, nothing client-side — plain backend service."

Q: who's the audience, and any compliance or regulatory requirements?
A: "Internal only — other services in our own infra call it. No SOC2/HIPAA/PCI requirement, no customer data flows through it."

Q: is this project AI-powered, or built with / used by LLM coding agents?
A: "No LLM calls at runtime — it's pure delivery plumbing. AGENTS.md is there for contributors using coding agents, but the service itself doesn't call a model."

Q: your only outbound calls are to subscriber webhooks — should Karen hold every one of those calls to a retry-with-backoff bar, or is there a legitimate reason some stay single-attempt?
A: "Hold them all to it. `Dispatcher.Send` and `SendDigest` are both real calls to another service over the network — there's no reason `Send` should be single-attempt when `SendDigest` already proves the retry pattern works. That's a real gap, not intentional."

Q: `ListDeliveryHistory` returns the full unbounded log for a subscriber — is that ever called from a request path, or only from internal tooling?
A: "It's called from an operator-facing HTTP handler, not just internal tooling — same trust boundary as the paginated version. It should have a cap like `ListDeliveryHistoryPage` does."

Q: your tests run with `go test` but produce no coverage report — want me to wire in `-coverprofile`, or run coverage-less for now with the gate set to assertion-density-only?
A: "Run coverage-less for now. We know we should wire in -coverprofile eventually but it's not a priority this quarter — assertion-density-only is fine."

## Must ask unprompted (source has signal, detect_project can't classify intent)
- coverage instrumentation choice (`go test` runs with no `-coverprofile` anywhere in CI or locally — detect_project can see the absence but can't decide whether the project wants coverage wired in or wants to run coverage-less; BLUEPRINT.md's "When no coverage instrumentation exists" section requires this be asked, not silently defaulted)
- resiliency bar for outbound webhook calls (source has both a single-attempt call (`Dispatcher.Send`) and a retrying one (`SendDigest`) to the same kind of subscriber webhook — detect_project can see both call sites but can't tell whether the single-attempt one is an intentional simplification or a gap; BLUEPRINT.md's Resiliency section says Karen decides which network calls this applies to during `karen init`, not by blanket rule)
- unbounded-read call-site trust boundary (source shows `ListDeliveryHistory` has no page cap, but detect_project can't tell from the function alone whether it's reachable from a request path or only from internal tooling — that distinguishes a real Performance & Resource Bounds finding from a low-risk internal helper)
- runtime LLM calls / agentic behavior (source is plain HTTP handlers with no model client anywhere — detect_project has no field for "does this call an LLM at runtime," only the interview can settle `aiPowered`)

## Must NOT ask (already answerable from detect_project output)
- primary implementation language (unambiguous from `go.mod`, no other manifest present)
- presence of continuous integration (`.github/workflows/ci.yml` already present and visible to detect_project)
- test runner selection (repo's existing CI workflow and source already show `go test`, no other runner configured)
