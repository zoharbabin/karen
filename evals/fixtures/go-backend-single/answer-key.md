## Answers
Q: what does this project do / who uses it?
A: "It's a Go backend service — webhook-relay. Accepts inbound webhook deliveries over HTTP and relays a delivery acknowledgment back to the sender's callback URL. Used internally, not customer-facing."

Q: what's your deployment/runtime environment?
A: "Runs as a standalone HTTP service, listens on :8080. No browser context, no CDN, nothing client-side — plain backend service."

Q: who's the audience, and any compliance or regulatory requirements?
A: "Internal only — other services in our own infra call it. No SOC2/HIPAA/PCI requirement, no customer data flows through it."

Q: is this project AI-powered, or built with / used by LLM coding agents?
A: "No LLM calls at runtime — it's pure HTTP relay plumbing. AGENTS.md is there for contributors using coding agents, but the service itself doesn't call a model."

Q: your tests run with `go test` but produce no coverage report — want me to wire in `-coverprofile`, or run coverage-less for now with the gate set to assertion-density-only?
A: "Run coverage-less for now. We know we should wire in -coverprofile eventually but it's not a priority this quarter — assertion-density-only is fine."

## Must ask unprompted (source has signal, detect_project can't classify intent)
- coverage instrumentation choice (`go test` runs with no `-coverprofile` anywhere in CI or locally — detect_project can see the absence but can't decide whether the project wants coverage wired in or wants to run coverage-less; BLUEPRINT.md's "When no coverage instrumentation exists" section requires this be asked, not silently defaulted)
- runtime LLM calls / agentic behavior (source is plain HTTP handlers with no model client anywhere — detect_project has no field for "does this call an LLM at runtime," only the interview can settle `aiPowered`)

## Must NOT ask (already answerable from detect_project output)
- primary implementation language (unambiguous from `go.mod`, no other manifest present)
- presence of continuous integration (`.github/workflows/ci.yml` already present and visible to detect_project)
- test runner selection (repo's existing CI workflow and source already show `go test`, no other runner configured)
