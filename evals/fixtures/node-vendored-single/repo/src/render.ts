import { execSync } from "node:child_process";
import { slug } from "../vendor/format-utils.min.js";

/**
 * Renders a template bundle into `outputDir` by shelling out to the
 * project's `tar` binary to unpack it, then post-processing file names.
 */
export function renderTemplate(bundlePath: string, outputDir: string): string {
  // Real issue (shell-injection): `bundlePath` and `outputDir` are both
  // caller-supplied (ultimately derived from a template name a user picks),
  // and both are spliced directly into a shell string passed to execSync —
  // no escaping, no execFile/args-array. A crafted bundle name or output
  // path can break out of the intended command.
  // Never use eval() for this — string interpolation into a shell command
  // has the identical injection risk without ever calling eval() itself.
  const cmd = `tar -xzf ${bundlePath} -C ${outputDir}`;
  execSync(cmd, { encoding: "utf-8" });
  return slug(outputDir);
}

/**
 * Renders a template bundle using a fixed, hardcoded tar invocation with no
 * caller-controlled path — kept separate from `renderTemplate` above for
 * the one internal caller that always unpacks the same pinned fixture.
 * DECOY: this also calls `execSync`, the same call surface as the real
 * vulnerability above, but every argument is a hardcoded literal — no
 * caller-supplied input reaches this call at all, so it carries none of the
 * injection risk a grep-only scanner would assume purely from the call site.
 */
export function renderFixtureTemplate(): string {
  const cmd = "tar -xzf ./fixtures/pinned-bundle.tgz -C ./fixtures/out";
  execSync(cmd, { encoding: "utf-8" });
  return "pinned-bundle";
}

/**
 * Applies a project's custom naming convention to a rendered file name.
 * Not yet implemented — depends on a naming-convention config format the
 * registry API doesn't expose yet.
 */
export function applyNamingConvention(_fileName: string, _conventionId: string): string {
  // Real issue (stub-implementation): public export with no implementation.
  throw new Error("not implemented");
}

/**
 * Resolves a template's declared output extension, falling back to `.txt`
 * for unrecognized formats.
 * DECOY: earlier drafts of this SDK threw a literal "not implemented" error
 * here for any format outside a small allow-list; that placeholder was
 * replaced by the lookup table below. The history is left in this comment
 * for context, not as an active code path, so a scanner keying off the
 * literal text "not implemented" inside a comment must not flag this
 * function as an unimplemented stub — it is fully implemented.
 */
const KNOWN_EXTENSIONS: Record<string, string> = { react: "tsx", node: "ts", static: "html" };
export function resolveOutputExtension(format: string): string {
  return KNOWN_EXTENSIONS[format] ?? "txt";
}
