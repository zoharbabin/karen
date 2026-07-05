// Command api runs the karen-go-mono backend HTTP service. It serves the
// project's REST API and delegates request handling to internal/server.
package main

import (
	"log"
	"net/http"

	"github.com/example/karen-go-mono/backend/internal/server"
)

func main() {
	srv := server.New()
	log.Fatal(http.ListenAndServe(":8080", srv))
}
