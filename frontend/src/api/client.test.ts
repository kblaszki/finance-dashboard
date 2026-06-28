import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient, getAuthToken, setAuthToken, setUnauthorizedHandler } from "./client";

describe("apiClient", () => {
  beforeEach(() => {
    setAuthToken(null);
    setUnauthorizedHandler(null);
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends Authorization header when token is set", async () => {
    setAuthToken("test-token");
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    await apiClient.get<{ ok: boolean }>("/api/test");

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/test"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
        }),
      }),
    );
    expect(getAuthToken()).toBe("test-token");
  });

  it("parses API error message from response body", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: "Account not found" }), { status: 404 }),
    );

    await expect(apiClient.get("/api/missing")).rejects.toThrow("Account not found");
  });

  it("calls unauthorized handler on 401", async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    );

    await expect(apiClient.get("/api/protected")).rejects.toThrow("Unauthorized");
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it("getBlob calls unauthorized handler on 401", async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    );

    await expect(apiClient.getBlob("/api/export")).rejects.toThrow("Unauthorized");
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it("returns undefined for 204 responses", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));

    const result = await apiClient.delete("/api/resource/1");
    expect(result).toBeUndefined();
  });
});

describe("fetchCashflow query", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ income: 1, expense: 2, net: -1, currency: "PLN" }), {
        status: 200,
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds period query params", async () => {
    const { fetchCashflow } = await import("./statsApi");
    await fetchCashflow({ from: "2025-01-01", to: "2025-01-31", currency: "EUR" });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/from=2025-01-01.*to=2025-01-31.*currency=EUR/),
      expect.any(Object),
    );
  });
});
