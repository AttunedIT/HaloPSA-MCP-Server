import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { afterEach, describe, it, mock } from "node:test";
import { HALO_USER_AGENT, HaloApiClient } from "../src/client/halo-api-client.js";
import type { HaloConfig } from "../src/config.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };
const EXPECTED_USER_AGENT = `attunedIT-HaloPSA-MCP/${version}`;

const config: HaloConfig = {
  tenantUrl: "https://halo.example.test",
  tenant: "example-tenant",
  clientId: "test-client-id",
  clientSecret: "test-client-secret",
  authUrl: "https://auth.example.test",
  scope: "all",
  timeoutMs: 5_000,
};

function headerValue(headers: HeadersInit | undefined, name: string): string | null {
  if (!headers) return null;
  const target = name.toLowerCase();
  if (headers instanceof Headers) return headers.get(name);
  if (Array.isArray(headers)) {
    const found = headers.find(([key]) => key.toLowerCase() === target);
    return found?.[1] ?? null;
  }
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target) return value;
  }
  return null;
}

describe("HaloApiClient User-Agent", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it("sends attunedIT-HaloPSA-MCP/<package version> on the OAuth token request and API calls", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];

    mock.method(globalThis, "fetch", async (url: string | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      const href = String(url);
      if (href.includes("/token")) {
        return Response.json({
          access_token: "test-access-token",
          token_type: "Bearer",
          expires_in: 3600,
        });
      }
      if (init?.method === "DELETE") {
        return new Response(null, { status: 204 });
      }
      return Response.json({ id: 1 });
    });

    assert.equal(HALO_USER_AGENT, EXPECTED_USER_AGENT);

    const client = new HaloApiClient(config);
    await client.get("/Tickets");
    await client.post("/Tickets", { summary: "example" });
    await client.delete("/Tickets/1");

    const tokenCalls = calls.filter((call) => call.url.includes("/token"));
    const apiCalls = calls.filter((call) => !call.url.includes("/token"));

    assert.equal(tokenCalls.length, 1);
    assert.equal(apiCalls.length, 3);

    for (const call of calls) {
      assert.equal(
        headerValue(call.init?.headers, "User-Agent"),
        EXPECTED_USER_AGENT,
        `User-Agent on ${call.init?.method ?? "GET"} ${call.url}`,
      );
    }
  });
});
