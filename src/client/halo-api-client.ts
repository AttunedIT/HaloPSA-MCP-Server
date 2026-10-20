import { createRequire } from "node:module";
import type { HaloConfig } from "../config.js";
import type { OAuthTokenResponse, HaloListResponse } from "./types.js";
import { extractListResponse } from "./types.js";

const require = createRequire(import.meta.url);
const { version } = require("../../package.json") as { version: string };

/** Sent on every HaloPSA request, including the OAuth token call. */
export const HALO_USER_AGENT = `attunedIT-HaloPSA-MCP/${version}`;

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

function wrapFetchError(error: unknown, context: string): Error {
  if (error instanceof Error) {
    if (error.name === "TimeoutError" || error.message.includes("timeout")) {
      return new Error(`${context}: Request timed out. Check HALOPSA_BASE_URL and network connectivity.`);
    }
    if (error.message === "fetch failed" || error.cause) {
      const cause = error.cause instanceof Error ? error.cause.message : "";
      return new Error(`${context}: Could not connect to HaloPSA (${cause || "network error"}). Verify HALOPSA_BASE_URL is correct and the server is reachable.`);
    }
    return new Error(`${context}: ${error.message}`);
  }
  return new Error(`${context}: ${String(error)}`);
}

export class HaloApiClient {
  private config: HaloConfig;
  private cachedToken: CachedToken | null = null;

  constructor(config: HaloConfig) {
    this.config = config;
  }

  /** Shared headers for every outbound Halo fetch. User-Agent cannot be overridden. */
  private buildHeaders(extra: Record<string, string> = {}): Record<string, string> {
    return {
      ...extra,
      "User-Agent": HALO_USER_AGENT,
    };
  }

  private async authenticate(): Promise<string> {
    // Return cached token if still valid (with 60s buffer)
    if (
      this.cachedToken &&
      Date.now() < this.cachedToken.expiresAt - 60_000
    ) {
      return this.cachedToken.accessToken;
    }

    const tokenUrl = `${this.config.authUrl}/token?tenant=${encodeURIComponent(this.config.tenant)}`;

    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      scope: this.config.scope,
    });

    let response: Response;
    try {
      response = await fetch(tokenUrl, {
        method: "POST",
        headers: this.buildHeaders({
          "Content-Type": "application/x-www-form-urlencoded",
        }),
        body: body.toString(),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
    } catch (error) {
      throw wrapFetchError(error, "HaloPSA authentication failed");
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `HaloPSA authentication failed (${response.status}): ${text}`
      );
    }

    const data = (await response.json()) as OAuthTokenResponse;

    this.cachedToken = {
      accessToken: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };

    return this.cachedToken.accessToken;
  }

  async get<T = unknown>(
    path: string,
    params?: Record<string, unknown>
  ): Promise<T> {
    const token = await this.authenticate();
    const url = new URL(`${this.config.tenantUrl}/api${path}`);

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== "") {
          url.searchParams.set(key, String(value));
        }
      }
    }

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        method: "GET",
        headers: this.buildHeaders({
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        }),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
    } catch (error) {
      throw wrapFetchError(error, `HaloPSA API error GET ${path}`);
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `HaloPSA API error GET ${path} (${response.status}): ${text}`
      );
    }

    return (await response.json()) as T;
  }

  /**
   * Convenience wrapper for list endpoints that return data under an
   * endpoint-specific key (e.g. "tickets", "clients", "assets").
   * Normalises the response into a standard HaloListResponse<T>.
   */
  async getList<T>(
    path: string,
    params?: Record<string, unknown>
  ): Promise<HaloListResponse<T>> {
    const raw = await this.get<Record<string, unknown> | unknown[]>(path, params);
    return extractListResponse<T>(raw);
  }

  async post<T = unknown>(
    path: string,
    body: unknown
  ): Promise<T> {
    const token = await this.authenticate();
    const url = `${this.config.tenantUrl}/api${path}`;

    // HaloPSA convention: POST bodies are wrapped in arrays
    const payload = Array.isArray(body) ? body : [body];

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: this.buildHeaders({
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        }),
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
    } catch (error) {
      throw wrapFetchError(error, `HaloPSA API error POST ${path}`);
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `HaloPSA API error POST ${path} (${response.status}): ${text}`
      );
    }

    return (await response.json()) as T;
  }

  async delete(path: string): Promise<void> {
    const token = await this.authenticate();
    const url = `${this.config.tenantUrl}/api${path}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: "DELETE",
        headers: this.buildHeaders({
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        }),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
    } catch (error) {
      throw wrapFetchError(error, `HaloPSA API error DELETE ${path}`);
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `HaloPSA API error DELETE ${path} (${response.status}): ${text}`
      );
    }
  }
}
