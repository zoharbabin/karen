## Answers
Q: what does this project do / who uses it?
A: "It's a two-module Go monorepo: `backend` is an internal HTTP API service, `cli` is `karenctl`, the operator command-line tool that talks to it. Used by our own infra/ops team, not distributed externally."

Q: I see two independent go.mod files — backend and cli — with no root go.mod tying them together. Should Karen treat these as two separate subprojects with their own profiles, or is one of them primary?
A: "Treat them as two separate subprojects — they're built, tested, and released independently. Neither is 'primary' over the other; they're peers."

Q: what's the deployment context and runtime environment for backend and cli respectively?
A: "backend runs as a long-lived internal HTTP service — node-server-equivalent deployment profile, not browser-facing. cli is a one-shot operator tool run from a terminal against that service; it's invoked locally, never deployed as a service itself."

Q: what's the audience and does this handle sensitive data?
A: "Internal only — our own ops team. No customer PII. The one thing that is sensitive: mint-admin-token.sh mints real admin bearer tokens against our internal auth endpoint, so that script's signing material is a live production credential, not a throwaway dev value."

Q: I found mint-admin-token.sh at the repo root — it's not under backend/ or cli/, and there's no go.mod at the root, so it isn't claimed by either module's manifest. How should Karen scope this for gates 2, 3, and 7?
A: "Scope it as its own root-utility pseudo-subproject, like the blueprint describes. It's shared ops tooling invoked by both modules' release pipelines and it mints credentials, so it needs the same security scrutiny as the two Go modules — don't let it fall through the cracks just because it has no go.mod."

Q: any compliance or regulatory requirements?
A: "No. Internal ops tooling — no SOC2, HIPAA, or PCI scope."

Q: is this project AI-powered, or built with / used by LLM coding agents?
A: "It's built day-to-day with Claude Code, but neither backend nor cli calls an LLM at runtime or exposes any agentic behavior to end users — it's a plain HTTP service and a plain CLI."

Q: what's your coverage threshold, and should backend and cli report separately?
A: "80% for both, reported separately — they're independent modules, so one shouldn't hide the other's coverage gaps."

## Must ask unprompted (source has signal, detect_project can't classify intent)
- how to scope the unclaimed `mint-admin-token.sh` script for gates 2/3/7 (detect_project's unclaimed-paths walk can report the file exists and belongs to no go.mod, but only the interview can decide whether it becomes its own root-utility pseudo-subproject, gets silently folded into one module, or is left out of scope entirely)
- whether `backend` and `cli` should be treated as independent subprojects or one primary + one secondary for profile purposes (detect_project reports two go.mod files but has no way to know from manifests alone whether the project owner considers one "primary")
- deployment context for backend vs. cli separately (detect_project can see two Go binaries under `cmd/` but can't tell a long-running HTTP service apart from a one-shot local operator CLI from source structure alone — the two need different zero-tolerance profiles)
- audience and data sensitivity of the credential-minting logic in `mint-admin-token.sh` (source shows a signing seed and a mint request, but detect_project can't tell whether that seed is a live production credential or a local-dev placeholder without asking)
- compliance or regulatory requirements (no compliance artifacts of any kind exist beyond SECURITY.md, so detect_project has no signal either way — must be asked, not assumed absent)
- coverage threshold and whether backend/cli report coverage jointly or separately (CI wires `-coverprofile` per module but no `.karen.json` or config file states a threshold or a joint/separate reporting preference)

## Must NOT ask (already answerable from detect_project output)
- agent context file presence (repo/AGENTS.md already present and already documents both modules' build/test commands)
- CI configuration presence (repo/.github/workflows/ci.yml already present and already runs `go build`/`go test -coverprofile` for both modules)
- which test runner is in use (both go.mod files plus AGENTS.md and ci.yml already establish `go test` as the runner for both modules)
- whether SECURITY.md exists (repo/SECURITY.md already present and already states its scope covers both Go modules and mint-admin-token.sh explicitly)
