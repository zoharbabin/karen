// Package mcpserver implements a minimal MCP (Model Context Protocol)
// server transport: newline-delimited JSON-RPC 2.0 over stdin/stdout. It
// holds no domain logic of its own — tool dispatch and validation live in
// package tools; this package only frames and routes requests.
package mcpserver

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"

	"github.com/example/karen-mcp-go/internal/tools"
)

// request is a JSON-RPC 2.0 request as sent by the connecting MCP client.
type request struct {
	ID     json.RawMessage `json:"id"`
	Method string          `json:"method"`
	Params json.RawMessage `json:"params"`
}

// response is a JSON-RPC 2.0 response written back to the connecting MCP
// client.
type response struct {
	ID     json.RawMessage `json:"id"`
	Result any             `json:"result,omitempty"`
	Error  *rpcError       `json:"error,omitempty"`
}

type rpcError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

// Serve reads newline-delimited JSON-RPC requests from r and writes
// responses to w until r is exhausted or a read error occurs.
func Serve(r io.Reader, w io.Writer) error {
	scanner := bufio.NewScanner(r)
	enc := json.NewEncoder(w)

	for scanner.Scan() {
		var req request
		if err := json.Unmarshal(scanner.Bytes(), &req); err != nil {
			_ = enc.Encode(response{Error: &rpcError{Code: -32700, Message: "parse error"}})
			continue
		}
		resp := dispatch(req)
		if err := enc.Encode(resp); err != nil {
			return err
		}
	}
	return scanner.Err()
}

// dispatch routes a single JSON-RPC request to the matching tool handler
// and builds the JSON-RPC response. Every tool call's arguments originate
// from whatever LLM client is connected to this server over stdio — they
// are untrusted input from this server's perspective regardless of what
// that client's own trust boundary looks like.
func dispatch(req request) response {
	switch req.Method {
	case "tools/list":
		return response{ID: req.ID, Result: toolList()}
	case "tools/call":
		return dispatchToolCall(req)
	default:
		return response{ID: req.ID, Error: &rpcError{Code: -32601, Message: fmt.Sprintf("unknown method: %s", req.Method)}}
	}
}

type toolCallParams struct {
	Name      string          `json:"name"`
	Arguments json.RawMessage `json:"arguments"`
}

func dispatchToolCall(req request) response {
	var params toolCallParams
	if err := json.Unmarshal(req.Params, &params); err != nil {
		return response{ID: req.ID, Error: &rpcError{Code: -32602, Message: "invalid params"}}
	}

	switch params.Name {
	case "run_shell_command":
		var args tools.RunShellCommandArgs
		if err := json.Unmarshal(params.Arguments, &args); err != nil {
			return response{ID: req.ID, Error: &rpcError{Code: -32602, Message: "invalid run_shell_command arguments"}}
		}
		out, err := tools.RunShellCommand(args)
		if err != nil {
			return response{ID: req.ID, Error: &rpcError{Code: -32000, Message: err.Error()}}
		}
		return response{ID: req.ID, Result: out}
	case "read_config":
		var args tools.ReadConfigArgs
		if err := json.Unmarshal(params.Arguments, &args); err != nil {
			return response{ID: req.ID, Error: &rpcError{Code: -32602, Message: "invalid read_config arguments"}}
		}
		out, err := tools.ReadConfig(args)
		if err != nil {
			return response{ID: req.ID, Error: &rpcError{Code: -32000, Message: err.Error()}}
		}
		return response{ID: req.ID, Result: out}
	default:
		return response{ID: req.ID, Error: &rpcError{Code: -32601, Message: fmt.Sprintf("unknown tool: %s", params.Name)}}
	}
}

func toolList() []map[string]string {
	return []map[string]string{
		{"name": "run_shell_command", "description": "Runs a shell command on the host and returns its combined output, for runbook automation."},
		{"name": "read_config", "description": "Returns the contents of a named config file from the server's config directory."},
	}
}
