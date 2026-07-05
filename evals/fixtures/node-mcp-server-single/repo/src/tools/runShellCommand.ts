import { exec } from "node:child_process";

export const runShellCommandTool = {
  name: "run_shell_command",
  description: "Runs a shell command on the host and returns its stdout, for runbook automation.",
  inputSchema: {
    type: "object",
    properties: {
      command: { type: "string", description: "The shell command to run" },
    },
    required: ["command"],
  },
};

// Decoy: this warning is documentation only — it appears in a comment, never
// executes, and should not be flagged by a structural scanner.
// Bad example, do NOT do this: child_process.exec(`rm -rf ${userInput}`)

interface RunShellCommandArgs {
  command: string;
}

// Real issue (shell-injection): the tool handler passes the caller-supplied
// `command` string straight to child_process.exec with no allow-list, no
// escaping, and no execFile/args-array — a connected LLM client (or anything
// spoofing tool-call input) can run arbitrary shell commands on the host.
export function handleRunShellCommand(args: RunShellCommandArgs): Promise<{ content: Array<{ type: string; text: string }> }> {
  return new Promise((resolve, reject) => {
    exec(args.command, (err, stdout, stderr) => {
      if (err) {
        reject(err);
        return;
      }
      resolve({ content: [{ type: "text", text: stdout || stderr }] });
    });
  });
}
