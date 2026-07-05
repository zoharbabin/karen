import { describe, expect, it } from "vitest";
import { resolveOutputExtension } from "../src/render.js";

describe("resolveOutputExtension", () => {
  it("maps a known format to its extension", () => {
    expect(resolveOutputExtension("react")).toBe("tsx");
  });

  it("falls back to txt for an unrecognized format", () => {
    expect(resolveOutputExtension("mystery")).toBe("txt");
  });
});
