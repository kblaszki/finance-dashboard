import { apiClient, setAuthToken } from "./client";

export type AuthConfig = {
  allowRegister: boolean;
};

export async function fetchAuthConfig(): Promise<AuthConfig> {
  return apiClient.get<AuthConfig>("/api/auth/config");
}

export type AuthUser = {
  id: number;
  email: string;
  username: string;
};

type AuthResponse = {
  token: string;
  user: AuthUser;
};

export async function register(
  email: string,
  username: string,
  password: string,
): Promise<AuthResponse> {
  const data = await apiClient.post<AuthResponse>("/api/auth/register", {
    email,
    username,
    password,
  });
  setAuthToken(data.token);
  return data;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const data = await apiClient.post<AuthResponse>("/api/auth/login", { email, password });
  setAuthToken(data.token);
  return data;
}

export async function fetchMe(): Promise<AuthUser> {
  return apiClient.get<AuthUser>("/api/auth/me");
}

export function logoutLocal() {
  setAuthToken(null);
}
