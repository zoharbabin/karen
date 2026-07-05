// Command server runs karen-mcp-go: a Model Context Protocol server that
// exposes run_shell_command and read_config tools over stdio to whatever
// MCP-compatible LLM client connects to it.
package main

import (
	"log"
	"os"

	"github.com/example/karen-mcp-go/internal/mcpserver"
)

func main() {
	if err := mcpserver.Serve(os.Stdin, os.Stdout); err != nil {
		log.Fatalf("karen-mcp-go: fatal transport error: %v", err)
	}
}
