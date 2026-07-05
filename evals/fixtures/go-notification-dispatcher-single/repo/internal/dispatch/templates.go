package dispatch

import "os/exec"

// compiledTemplateCache holds the digest-template renderer's compiled
// output, built once at process startup.
//
// PLANTED VULNERABILITY (eager-heavy-startup, real): compileDigestTemplates
// shells out to an external template compiler at package-init time — a
// subprocess spawned before any request has ever asked for a digest,
// paid by every process that imports this package even if it never
// sends a single digest. BLUEPRINT.md's Performance & Resource Bounds
// section calls this out directly: "expensive imports, subprocess
// spawns... made at module load time are deferred until the feature
// that needs them actually runs."
var compiledTemplateCache = compileDigestTemplates()

func compileDigestTemplates() string {
	out, err := exec.Command("digest-template-compiler", "--stdlib").CombinedOutput()
	if err != nil {
		return ""
	}
	return string(out)
}
