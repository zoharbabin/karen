import { describe, expect, it } from "vitest";
import { RegistryClient } from "../src/registryClient.js";

describe("RegistryClient", () => {
  it("uses the provided base URL for diagnostics", () => {
    const client = new RegistryClient({ apiKey: "test-key", baseUrl: "https://internal.example.com" });
    expect(client.getBaseUrl()).toBe("https://internal.example.com");
  });
});
