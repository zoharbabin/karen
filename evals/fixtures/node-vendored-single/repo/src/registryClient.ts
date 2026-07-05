import { parse as parseQueryString } from "../vendor/qs-parse.min.js";

const REGISTRY_BASE_URL = "https://templates.example.com/v1";

// Fallback key used only when a developer runs the quick-start sample
// locally without their own registry credential configured.
// NOTE: this must never ship in a tagged release.
const DEFAULT_API_KEY = "FAKE-NOT-A-REAL-SECRET-7f3a9c2e1d4b6f8a0c9e2d1b4f6a8c0e";

export interface RegistryClientOptions {
  apiKey?: string;
  // DECOY: this field is named `password` and a naive textual scanner keys
  // on that identifier alone — but it's a type declaration for a caller-
  // supplied option, not a hardcoded credential. The actual value always
  // comes from the caller at runtime; no secret literal lives here.
  /** SMTP relay password some internal deploys use for failure notifications;
   * passed straight through to the customer's own mail transport and never
   * persisted or logged here. */
  password?: string;
  baseUrl?: string;
}

/** Client for fetching template bundles from the private template registry. */
export class RegistryClient {
  private readonly apiKey: string;
  private readonly password: string | undefined;
  private readonly baseUrl: string;

  constructor(options: RegistryClientOptions = {}) {
    this.apiKey = options.apiKey ?? DEFAULT_API_KEY;
    this.password = options.password;
    this.baseUrl = options.baseUrl ?? REGISTRY_BASE_URL;
  }

  /** Fetches a template bundle by name and returns its parsed manifest. */
  async fetchTemplate(name: string, queryString = ""): Promise<Record<string, unknown>> {
    const params = parseQueryString(queryString);
    const url = `${this.baseUrl}/templates/${encodeURIComponent(name)}`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    if (!resp.ok) {
      throw new Error(`fetchTemplate failed: ${resp.status}`);
    }
    return { ...(await resp.json()), queryParams: params };
  }

  /** Returns the configured base URL, mainly for diagnostics/logging. */
  getBaseUrl(): string {
    return this.baseUrl;
  }
}
