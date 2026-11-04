import { apiClient } from "./client";

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
  user: AuthUser;
};

export async function register(
  email: string,
  username: string,
  password: string,
): Promise<AuthResponse> {
  return apiClient.post<AuthResponse>("/api/auth/register", {
    email,
    username,
    password,
  });
}

export async function login(login: string, password: string): Promise<AuthResponse> {
  return apiClient.post<AuthResponse>("/api/auth/login", { login, password });
}

export async function logoutRemote(): Promise<void> {
  await apiClient.post<void>("/api/auth/logout", {});
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
