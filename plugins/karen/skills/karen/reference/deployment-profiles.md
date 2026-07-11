# Deployment context profiles

Knowledge to apply based on what the interview surfaced. These shape the security gate and may add additional gates. Selected via the interview or set in `.karen.json` under `project.deployment`.

---

## `browser-direct-js`

*The project's code loads via `<script src>` or `npm install` into the customer's page.*
*There is no sandbox. It is a trusted guest in someone else's house.*
*Every violation affects the customer's entire page, not just the SDK's.*

**Additional zero-tolerance checks:**

- Global scope writes (`window.*`, `globalThis.*` outside constructor opt-in)
- Event listeners without paired removal in `destroy()`
- Prototype modifications (`Array.prototype.*`, etc.)
- `setInterval`/`setTimeout` without cleanup reference
- `console.*` outside debug-mode guard
- `credentials: 'include'` in fetch/XHR

**Zero-tolerance checks flex by subproject code role, not just by per-line exception.** These patterns are calibrated for code a customer embeds — a library or SDK entry point. They aren't calibrated for a subproject whose entire purpose is to exercise or debug that surface: an API explorer with an intentional verbose wire log, a capture tool that deliberately logs raw traffic for protocol verification. Forcing those through the same zero-tolerance bar either produces noise the team has to `// karen-ignore` line-by-line forever, or trains them to ignore the gate. A `project.subprojects` entry (see `karen-json-schema.md`) carries a `codeRole` field — e.g. `"codeRole": "debug-tool"` — set during the interview when a subproject's stated purpose is internal debugging, protocol capture, or API exploration rather than customer-facing distribution. A `debug-tool` code role relaxes exactly the checks whose rationale doesn't apply to it (`console.*` outside debug-guard, for one) while leaving the rest of the zero-tolerance list — credential leaks, `eval`, path traversal — fully in force, since those risks don't depend on who the audience is. The relaxation is declared once per subproject in `.karen.json`, not re-justified per line with a decaying exception.

**Required architectural pattern — instance isolation:**

```js
const sdk = new MySDK({ container: '#target', ...config })
// All state held internally. Nothing outside #target is touched.
// No unscoped page-level listeners registered.

sdk.destroy()
// Every listener removed. Every timer cleared. Every reference nulled.
// Page is identical to pre-instantiation state.
```

**SRI requirements (for CDN-loaded assets):**

- Release notes include an `integrity` hash
- README default example uses `integrity` + `crossorigin="anonymous"`
- CDN URL uses an explicit version; never `/latest/`

**Documented capabilities** — any of these require a `permissions` entry in `.karen.json` with plain-English justification:

| Capability | Minimum required policy |
|---|---|
| `microphone` | `Permissions-Policy: microphone=(self)` |
| `camera` | `Permissions-Policy: camera=(self)` |
| `blob:` / `mediastream:` URLs | `media-src blob: mediastream:` |
| WebSocket to external domains | `connect-src wss://exact-domain.com` — no wildcard TLD |
| Autoplay | Documented fallback for browsers requiring a prior user gesture |

The SDK must never require the customer to add `unsafe-eval`, `unsafe-inline` in `script-src`, or `*` in any CSP directive.

### JavaScript & TypeScript language notes

Karen's supply-chain/completeness/security/docs/agent-context checks gain language-specific behavior for JS/TS. Detection is automatic: if `package.json` is present and `go.mod` is absent, activate JS/TS checks alongside the standard gates.

**Supply chain:** generate an npm branch using `npm audit` when a `package-lock.json` or `yarn.lock` is detected, run once per `package.json` found (see `monorepo.md`). Also check any `vendor/`, `public/vendor/`, or `third_party/` directory for provenance per Vendored & Copied-In Code in `quality-dimensions.md` — a minified library dropped into a static assets folder is common in browser-facing JS/TS projects and won't appear in `package.json` at all.

**Completeness:** scan for unimplemented stubs across `*.js`, `*.mjs`, `*.ts`, `*.tsx` files (excluding `node_modules/`, `dist/`, `coverage/`, and any vendor directory identified above). Flag `throw new Error('not implemented')`, `TODO`/`FIXME`/`HACK`/`XXX` markers, undocumented public exports (JSDoc or TypeScript `@public` required).

**Security:** apply JavaScript-specific patterns — `eval()`/`Function()` constructor calls, `require()` with dynamic user-supplied strings, `child_process.exec()` without a parameter array (must use `execFile`).

**Docs parity:** run markdown doctest blocks tagged `js`, `ts`, `javascript`, or `typescript` (configurable via `.karen.json` `doctest.languages`).

**Test integrity:** support Node.js coverage tools — `c8` (recommended; generates LCOV reports), built-in V8 coverage via `node --experimental-coverage` (Node 22+), or Jest `--coverage`. Set `testRunner.coverageReport` in `.karen.json` to the LCOV or JSON coverage file path.

**Agent context:** check for `CLAUDE.md`, `.cursorrules`, or `.github/copilot-instructions.md` in the monorepo root or per-package.

**Exclusion rationale:** `node_modules/`, `dist/`, `.next/`, `build/`, `coverage/`, and any `vendor/`-style directory of copied-in third-party code are build artifacts, dependency trees, or unowned code — not project source. Scanning them generates hundreds of false positives. This exclusion is about noise reduction for completeness/structure gates only — it doesn't exempt vendored code from the supply-chain risk it represents.

**Monorepo support:** multiple `package.json` files are supported — see `monorepo.md`. Test integrity doesn't stop at the first `package.json` with a test script; `.karen.json` declares which packages are audited and how:

```json
"testRunner": {
  "packages": [
    { "path": "sdk", "command": "npm test", "coverageReport": "sdk/coverage/lcov.info", "role": "primary" },
    { "path": "apps/harness", "command": "npm run test:fake", "coverageReport": null, "role": "e2e-only" },
    { "path": "apps/teaching-avatar", "command": "npm run eval:probes", "coverageReport": null, "role": "e2e-only" }
  ]
}
```

Each package gets its own gate-6 result line. A package marked `"role": "e2e-only"` is checked for assertion density and test presence but not held to the coverage threshold. A package marked `"primary"` is the one whose coverage number is reported as the headline figure; others report individually but don't block on a number they can't produce. During `karen init`, discover every `package.json` with a test script and ask which one (if any) is the primary coverage target, rather than guessing the first one found.

---

## `browser-iframe`

*The product is hosted on the project's own domain; the customer embeds via `<iframe>`.*
*The iframe boundary is a free sandbox. The threat shifts to cross-origin messaging.*

**Additional checks:**

- `postMessage(data, '*')` with session or auth payload — must use an exact origin
- `message` event handlers missing `event.origin` validation
- Trusted origin allowlist not locked at build time

Document COOP/COEP incompatibilities if `SharedArrayBuffer` is used.

---

## `node-server`

*Server-side Node.js, Deno, or Bun applications and services.*

**Additional checks:**

- `child_process.exec` with unsanitized input — use `execFile` with an args array
- `require()` with dynamic user-supplied string
- Unhandled promise rejections
- Secrets read from environment without startup validation
- No rate limiting on public HTTP endpoints

---

## `python`

*Python applications, services, and packages.*

**Additional checks:**

- `subprocess` with `shell=True` and unsanitized input
- `pickle.loads` on untrusted data
- `yaml.load` without `Loader=yaml.SafeLoader`
- `eval()` / `exec()` on user-supplied strings

---

## `ai-agent`

Covers two distinct things — a project can be either, or both, and the interview tells them apart.

**The project is built using LLM coding agents** (Claude Code, Cursor, etc. write its code). This activates the Agent Context Engineering gate (`quality-dimensions.md`) — it's about how the agent that *writes* the project's code stays disciplined, not about the product itself.

**The project's runtime *is* an AI product** — it calls an LLM, runs agentic tool-calling, renders model output to users, or exposes a conversational surface. This is a different, additional security surface: the threat isn't "the coding agent drifted," it's "the product's own AI can be attacked or can misbehave toward end users." The security gate (not just the agent-context gate) adds checks mapped to OWASP's Top 10 for LLM Applications and the Agentic Security Initiative:

| Threat class | What the security gate checks |
|---|---|
| Prompt injection (LLM01) | Untrusted/user-controlled text reaching a system prompt or tool-call context without a documented input filter |
| Improper output handling (LLM05) | Model output written to the DOM via `innerHTML` or unescaped interpolation instead of a safe sink |
| Excessive agency (LLM06 / ASI 01-02) | Agent-initiated actions (tool calls, navigation, side effects) with no gate/allow-list/human-in-the-loop checkpoint before they take effect — the bar for what counts as "adequately gated" is set per subproject via `agentActions.scope` (below) |
| Unbounded consumption (LLM10) | No rate limit or turn cap on a conversational loop that can be driven by user input |
| Supply chain (LLM03) | Model/weights/prompt-template provenance — distinct from the standard dependency audit, which still applies in parallel |

A project is `aiPowered: true` in `.karen.json` if *either* condition holds. Ask both questions separately — "is this built with AI coding agents?" and "does this product call an LLM or run agentic behavior at runtime?" — because a project can be one without the other, and the checks that follow are different in each case.

**A tool-provider server — an MCP server, a plugin, a webhook handler invoked by someone else's agent loop — is `aiPowered: true` even though it never itself calls an LLM.** This is a third case the two questions above can miss if read too literally: the project doesn't call an LLM, and it wasn't necessarily built by a coding agent either, yet its runtime is still driven by tool-call arguments an LLM decided to send. The threat model is the same one the runtime-AI branch exists for — LLM01 (a connecting model's tool-call arguments are untrusted input reaching this server exactly like a network request), LLM06/ASI excessive agency (the server executes actions an agent initiated, whether or not that agent lives in this process) — so exempting it because "we never call the model ourselves" would silently drop coverage from the exact tool-call surface (`run_shell_command`, `apply_config_patch`, or equivalent) that needs it most. During `karen init`, if `detect_project` finds an MCP SDK dependency, a plugin manifest, or another tool-provider shape, ask the runtime-AI question as "are you invoked by an LLM's tool-calling loop, even if you never call one yourself?" — not just "do you call an LLM" — precisely so a plain tool-provider doesn't get waved through as `aiPowered: false` by a literal reading of the first two questions.

**The excessive-agency bar is not one-size-fits-all across a repo with multiple tool-calling surfaces.** A repo can legitimately contain both a customer-facing app with a deliberately narrow, least-privilege tool-call allow-list and an internal test harness whose entire purpose is exercising the *maximal* tool surface for QA — checking both against the same bar either fails the harness for doing its job or passes the customer-facing app on a bar too loose to mean anything. Each `project.subprojects` entry with `aiPowered: true` carries an `agentActions.scope` field — `least-privilege` or `maximal` — with a `reason`, set during the interview per subproject rather than once globally. A `least-privilege`-scoped subproject is checked against "every agent-initiated action has an explicit allow-list entry or human-in-the-loop checkpoint"; a `maximal`-scoped subproject is checked against a looser, explicitly-declared bar — e.g. "every action the harness exercises is logged and reviewable" rather than "the surface is minimal." Declaring `maximal` does not exempt a subproject from the *other* OWASP checks above — prompt injection, output handling, and unbounded consumption still apply at full strength regardless of `agentActions.scope`; only the excessive-agency bar itself flexes.

**A project can also be a content producer for someone else's agent.** Every threat class above is framed inbound — untrusted input reaching *this* project's LLM or tool-call surface. But a tool-provider's responses cross the same boundary in the other direction: a connecting LLM treats whatever a tool call returns as part of its own context, not as inert data, unless the response makes that distinction explicit. File contents, command output, or any other externally-sourced string returned from a tool call without a clear delimiter marking it as data-not-instructions is an indirect-prompt-injection vector into whichever LLM is calling this server. This applies whether or not the connecting agent lives in this process: an MCP server returning raw file/command output, a webhook responder relaying an upstream payload, or any API whose response body a downstream agent parses as untrusted-but-unmarked text all carry it.

Also add, when the runtime-AI condition holds:

- Human-in-the-loop checkpoints documented for irreversible agent-initiated actions
- Model selection rationale documented (for the project's *own* LLM calls, not Karen's)
- `// karen-ignore` or equivalent escape documented for scanner definition files
