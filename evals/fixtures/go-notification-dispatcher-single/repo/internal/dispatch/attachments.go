package dispatch

import (
	"fmt"
	"os/exec"
	"sync"
)

// attachmentConverter is lazily built the first time a digest actually
// needs an attachment rendered, not at package load.
//
// DECOY (eager-heavy-startup category): this also shells out to an
// external binary, textually similar to compileDigestTemplates in
// templates.go, but the subprocess spawn happens inside a
// sync.Once-guarded lazy accessor invoked only from RenderAttachment —
// a caller who never sends a digest with an attachment never pays this
// cost. A scanner that flags every "exec.Command referenced from a
// package-level identifier" without checking whether the call is
// actually deferred behind first-use would wrongly flag this alongside
// the genuinely eager compiledTemplateCache.
var (
	attachmentConverterOnce sync.Once
	attachmentConverterPath string
)

func attachmentConverter() string {
	attachmentConverterOnce.Do(func() {
		out, err := exec.Command("which", "attachment-converter").CombinedOutput()
		if err == nil {
			attachmentConverterPath = string(out)
		}
	})
	return attachmentConverterPath
}

// RenderAttachment converts a digest attachment using the lazily
// resolved converter binary.
func RenderAttachment(path string) (string, error) {
	converter := attachmentConverter()
	if converter == "" {
		return "", fmt.Errorf("renderAttachment: no attachment converter available")
	}
	return converter + ":" + path, nil
}
