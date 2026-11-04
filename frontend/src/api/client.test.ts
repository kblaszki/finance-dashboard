import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient, setUnauthorizedHandler } from "./client";

describe("apiClient", () => {
  beforeEach(() => {
    setUnauthorizedHandler(null);
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends credentials include without Authorization header", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    await apiClient.get<{ ok: boolean }>("/api/test");

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/test"),
      expect.objectContaining({
        credentials: "include",
      }),
    );
    const init = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
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

  it("keeps Content-Type when posting JSON", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 200 }));

    await apiClient.post("/api/test", { name: "A" });

    const init = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
    expect(init.credentials).toBe("include");
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
