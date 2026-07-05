import { describe, it, expect } from "vitest";
import { readConfigTool } from "../src/tools/readConfig.js";

describe("readConfigTool", () => {
  it("declares a filename parameter", () => {
    expect(readConfigTool.inputSchema.required).toContain("filename");
  });
});
