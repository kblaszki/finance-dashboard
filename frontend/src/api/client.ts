const TOKEN_KEY = "finance_dashboard_token";

let onUnauthorized: (() => void) | null = null;

export function getApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL;
  if (fromEnv != null && String(fromEnv).length > 0) {
    return String(fromEnv);
  }
  return import.meta.env.DEV ? "http://localhost:4000" : "";
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const token = getAuthToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    headers,
    ...options,
  });

  if (response.status === 401) {
    onUnauthorized?.();
    throw new Error("Unauthorized");
  }

  if (!response.ok) {
    let message = `API error: ${response.status}`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function requestBlob(path: string, options?: RequestInit): Promise<Blob> {
  const headers: Record<string, string> = {};

  const token = getAuthToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    headers,
    ...options,
  });

  if (response.status === 401) {
    onUnauthorized?.();
    throw new Error("Unauthorized");
  }

  if (!response.ok) {
    let message = `API error: ${response.status}`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  return response.blob();
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  delete: (path: string) => request<void>(path, { method: "DELETE" }),
  getBlob: (path: string) => requestBlob(path),
};
