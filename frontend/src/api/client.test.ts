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

  it("surfaces a wrong-password 400 without clearing the session", async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: "Current password is incorrect" }), { status: 400 }),
    );

    await expect(apiClient.patch("/api/auth/password", {})).rejects.toThrow(
      "Current password is incorrect",
    );
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("keeps Authorization when the caller also sets headers", async () => {
    setAuthToken("test-token");
    vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 200 }));

    await apiClient.post("/api/test", { name: "A" });

    const init = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-token");
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("maps a failed fetch to a network error", async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(apiClient.get("/api/test")).rejects.toThrow("Network request failed");
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
