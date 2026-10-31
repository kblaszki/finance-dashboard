import { apiClient } from "./client";

export type AppConfig = {
  marketLiveApi: boolean;
};

export async function fetchAppConfig(): Promise<AppConfig> {
  return apiClient.get<AppConfig>("/api/app-config");
}

export async function updateAppConfig(
  patch: Partial<AppConfig>,
): Promise<AppConfig> {
  return apiClient.patch<AppConfig>("/api/app-config", patch);
}
