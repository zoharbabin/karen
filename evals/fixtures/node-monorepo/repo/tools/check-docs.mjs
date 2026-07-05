#!/usr/bin/env node
// check-docs.mjs — existing repo-wide doc/code hygiene script, run from
// `.github/workflows/ci.yml` as `node tools/check-docs.mjs`. Predates Karen.
//
// What it covers (see fixture-manifest.json's `existingGates` entry for the
// exact reconciliation this maps to):
//   1. Every relative link in a tracked markdown file resolves to a real
//      file (doc<->code link-rot check — full coverage of gate-4-docs-parity
//      for this fixture, alongside #2 below).
//   2. Every backtick-quoted `symbolName(` reference in a package's README
//      matches a real exported symbol somewhere under that package's src/
//      (doc<->code drift check — the other half of gate-4-docs-parity).
//   3. A secret-shaped regex scan over every *tracked* file (`git ls-files`)
//      — partial coverage of gate-3-security: catches secret VALUES by
//      shape (structural), not by variable name, but only looks at files
//      committed to git; it does not see the working tree.
//   4. A structural stub-marker scan over tracked source (`//` comments
//      containing TODO/FIXME/HACK/XXX, and `throw new Error('not
//      implemented...')`) — partial coverage of gate-2-completeness: does
//      not do per-symbol doc/test coverage, only stub-marker presence.
//
// Exits 0 if every check passes, 1 otherwise. Prints one line per finding.

import { execSync } from 'node:child_process';
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

const EXCLUDED_DIRS = new Set(['node_modules', 'dist', 'coverage', '.git', 'build']);

function listTrackedFiles() {
  try {
    const out = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' });
    return out.split('\n').filter(Boolean);
  } catch {
    // Not inside a git work tree (or git unavailable) — fall back to a
    // manual walk so this script still works against a plain directory.
    const results = [];
    const walk = (dir) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (EXCLUDED_DIRS.has(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else {
          results.push(path.relative(ROOT, full));
        }
      }
    };
    walk(ROOT);
    return results;
  }
}

const trackedFiles = listTrackedFiles();
const markdownFiles = trackedFiles.filter((f) => f.endsWith('.md'));
// Excludes this script itself — its own doc comment above names the marker
// tokens it scans for, which would otherwise self-flag as a stub.
const sourceFiles = trackedFiles.filter(
  (f) => /\.(js|mjs|ts|tsx)$/.test(f) && !f.startsWith('vendor/') && f !== 'tools/check-docs.mjs',
);

const findings = [];

// --- Check 1: relative markdown links resolve -----------------------------
const LINK_RE = /\[[^\]]*\]\(([^)]+)\)/g;

for (const mdFile of markdownFiles) {
  const text = readFileSync(path.join(ROOT, mdFile), 'utf8');
  let match;
  while ((match = LINK_RE.exec(text)) !== null) {
    const target = match[1].split('#')[0].trim();
    if (target === '' || /^([a-z]+:)?\/\//i.test(target) || target.startsWith('mailto:')) continue;
    const resolved = path.resolve(path.dirname(path.join(ROOT, mdFile)), target);
    if (!existsSync(resolved)) {
      findings.push(`${mdFile}\tdead relative link "${target}"`);
    }
  }
}

// --- Check 2: README symbol references match real exports -----------------
const EXPORT_RE = /export\s+(?:async\s+)?(?:function|class|const|interface)\s+([A-Za-z0-9_]+)/g;
const SYMBOL_REF_RE = /`([A-Za-z][A-Za-z0-9_]*)\(/g;

function packageDirFor(mdFile) {
  // Root README documents the whole repo, not one package's exports.
  const dir = path.dirname(mdFile);
  if (dir === '.') return null;
  return dir;
}

function collectExports(packageDir) {
  const exported = new Set();
  const srcDir = path.join(ROOT, packageDir, 'src');
  if (!existsSync(srcDir)) return exported;
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRS.has(entry.name)) walk(full);
      } else if (/\.tsx?$/.test(entry.name)) {
        const text = readFileSync(full, 'utf8');
        let m;
        while ((m = EXPORT_RE.exec(text)) !== null) exported.add(m[1]);
      }
    }
  };
  walk(srcDir);
  return exported;
}

for (const mdFile of markdownFiles) {
  if (path.basename(mdFile) !== 'README.md') continue;
  const packageDir = packageDirFor(mdFile);
  if (!packageDir) continue;
  const exported = collectExports(packageDir);
  if (exported.size === 0) continue;
  const text = readFileSync(path.join(ROOT, mdFile), 'utf8');
  let match;
  while ((match = SYMBOL_REF_RE.exec(text)) !== null) {
    const symbol = match[1];
    // Only judge symbols that look like this package's own public API
    // (PascalCase class or the SDK's own camelCase helpers) — ignore
    // built-ins like fetch(, JSON.stringify(, etc. by requiring the
    // symbol to already exist as text somewhere in the package's src.
    const looksLikeOwnSymbol = /^[A-Z]/.test(symbol) || exported.has(symbol);
    if (!looksLikeOwnSymbol) continue;
    if (!exported.has(symbol)) {
      findings.push(`${mdFile}\tdocuments "${symbol}(" but no matching export found under ${packageDir}/src`);
    }
  }
}

// --- Check 3: secret-shaped value scan (structural, not by name) ----------
const SECRET_VALUE_PATTERNS = [
  /sk-live-[a-f0-9]{16,}/i,
  /sk_live_[A-Za-z0-9]{16,}/,
  /AKIA[0-9A-Z]{16}/,
];

for (const file of sourceFiles) {
  const text = readFileSync(path.join(ROOT, file), 'utf8');
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const pattern of SECRET_VALUE_PATTERNS) {
      if (pattern.test(lines[i])) {
        findings.push(`${file}:${i + 1}\tsecret-shaped value committed to a tracked file`);
        break;
      }
    }
  }
}

// --- Check 4: structural stub-marker scan ----------------------------------
const COMMENT_STUB_RE = /\/\/.*\b(TODO|FIXME|HACK|XXX)\b/;
const THROW_STUB_RE = /throw\s+new\s+Error\(\s*['"`][^'"`]*not implemented/i;

for (const file of sourceFiles) {
  const text = readFileSync(path.join(ROOT, file), 'utf8');
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (COMMENT_STUB_RE.test(lines[i]) || THROW_STUB_RE.test(lines[i])) {
      findings.push(`${file}:${i + 1}\tstub marker in tracked source`);
    }
  }
}

// --- Report -----------------------------------------------------------------
if (findings.length === 0) {
  console.log('check-docs: PASS (0 issues)');
  process.exit(0);
}

for (const finding of findings) {
  console.log(finding);
}
console.log(`check-docs: FAIL (${findings.length} issues)`);
process.exit(1);
