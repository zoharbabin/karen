// Command karenctl is the operator CLI for karen-go-mono. It reads local
// config and talks to the backend service's REST API.
package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/example/karen-go-mono/cli/internal/config"
)

func main() {
	configPath := flag.String("config", "karenctl.yaml", "path to karenctl config file")
	flag.Parse()

	cfg, err := config.Load(*configPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "karenctl: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("karenctl targeting %s\n", cfg.APIBaseURL)
}
