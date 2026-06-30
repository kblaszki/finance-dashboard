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

export async function login(login: string, password: string): Promise<AuthResponse> {
  const data = await apiClient.post<AuthResponse>("/api/auth/login", { login, password });
  setAuthToken(data.token);
  return data;
}

export async function fetchMe(): Promise<AuthUser> {
  return apiClient.get<AuthUser>("/api/auth/me");
}

export async function updateProfile(username: string): Promise<AuthUser> {
  return apiClient.patch<AuthUser>("/api/auth/profile", { username });
}

export async function updatePassword(
  currentPassword: string,
  newPassword: string,
): Promise<AuthUser> {
  return apiClient.patch<AuthUser>("/api/auth/password", { currentPassword, newPassword });
}

export async function updateEmail(email: string, currentPassword: string): Promise<AuthUser> {
  return apiClient.patch<AuthUser>("/api/auth/email", { email, currentPassword });
}

export function logoutLocal() {
  setAuthToken(null);
}
