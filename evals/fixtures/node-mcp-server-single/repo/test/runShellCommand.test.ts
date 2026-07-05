import { describe, it, expect } from "vitest";
import { runShellCommandTool } from "../src/tools/runShellCommand.js";

describe("runShellCommandTool", () => {
  it("declares a command parameter", () => {
    expect(runShellCommandTool.inputSchema.required).toContain("command");
  });
});
