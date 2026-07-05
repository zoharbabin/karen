## Answers
Q: what does this project do / who uses it?
A: "It's a Node/TypeScript SDK that fetches and renders codegen scaffolding templates from our private template registry. Used by our own internal CLI tools — not distributed to external customers, and never loaded via `<script src>` in a browser."

Q: what's the deployment context and runtime environment?
A: "It's an npm-installed library that runs inside internal Node CLI tooling — node-server style, not browser-direct-js. It's never bundled into a page."

Q: what's the audience and does it handle sensitive data?
A: "Internal only — our own developer tooling team. No PII or payment data. The registry API key it talks to is a real credential though, so treat that as sensitive."

Q: any compliance or regulatory requirements?
A: "No. Internal tooling — no SOC2, HIPAA, or PCI requirement."

Q: is this project AI-powered, or built with / used by LLM coding agents?
A: "It's built with Claude Code day to day, but the SDK itself doesn't call an LLM at runtime and isn't invoked by one — it's a plain template-fetching client library."

Q: I see two minified files under vendor/ — qs-parse.min.js has a THIRD_PARTY.md entry but format-utils.min.js doesn't. Was that intentional, or did the provenance note get missed?
A: "That was missed — format-utils.min.js should have gotten a THIRD_PARTY.md entry when it was vendored in. Please flag it; we'll backfill the entry."

Q: what's your coverage threshold?
A: "80% is fine, same as our other internal packages."

## Must ask unprompted (source has signal, detect_project can't classify intent)
- provenance coverage gap between the two vendored files (source shows `vendor/qs-parse.min.js` and `vendor/format-utils.min.js` both exist, and `THIRD_PARTY.md` exists and documents `qs-parse.min.js`, but detect_project can only report file presence — it can't determine on its own whether the missing `format-utils.min.js` entry is an intentional omission or a documentation gap; only the interview can settle that)
- deployment context / distribution mechanism (package.json has no `browser` field and no bundler config pointing at a CDN artifact, but detect_project can't infer from that alone whether this ships browser-direct-js or node-server — the two have materially different zero-tolerance checks)
- audience and data sensitivity of the registry API key (source shows a live-looking `DEFAULT_API_KEY` fallback and a `RegistryClientOptions.apiKey` field, but detect_project can't tell whether this key is treated as a real production secret or a throwaway local-dev convenience without asking)
- compliance or regulatory requirements (no compliance artifacts of any kind exist in the repo, so detect_project has no signal either way — must be asked, not assumed absent)

## Must NOT ask (already answerable from detect_project output)
- linting setup (repo/.eslintrc.json already present and configured)
- test runner and coverage tool (repo/vitest.config.ts and the `@vitest/coverage-v8` devDependency already present)
- CI configuration (repo/.github/workflows/ci.yml already present)
- agent context file presence (repo/CLAUDE.md already present)
