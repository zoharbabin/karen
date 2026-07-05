package diag

import (
	"net"
	"net/http"
)

// ResolveHandler resolves the fixed relay-upstream hostname for operator
// diagnostics — used to confirm DNS resolution from inside the container
// without shelling out to `dig`/`nslookup`. Takes no request input.
func ResolveHandler(w http.ResponseWriter, r *http.Request) {
	addrs, err := net.LookupHost("upstream.internal")
	if err != nil {
		http.Error(w, "resolution failed", http.StatusServiceUnavailable)
		return
	}

	w.Header().Set("Content-Type", "text/plain")
	for _, addr := range addrs {
		w.Write([]byte(addr + "\n"))
	}
}
