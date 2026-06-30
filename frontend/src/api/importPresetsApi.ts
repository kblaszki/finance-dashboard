import { apiClient } from "./client";

export type ImportPresetList = {
  builtin: Array<{
    id: string;
    name: string;
    broker: string;
    targetType: string;
    columnMapping: Record<string, string>;
    builtin: boolean;
  }>;
  custom: Array<{
    id: number;
    name: string;
    broker: string;
    targetType: string;
    columnMapping: Record<string, string>;
    builtin: boolean;
    createdAt: string;
  }>;
};

export function fetchImportPresets() {
  return apiClient.get<ImportPresetList>("/api/import/presets");
}

export function createImportPreset(input: {
  name: string;
  broker: string;
  targetType: string;
  columnMapping: Record<string, string>;
}) {
  return apiClient.post<ImportPresetList["custom"][number]>("/api/import/presets", input);
}

export function deleteImportPreset(id: number) {
  return apiClient.delete(`/api/import/presets/${id}`);
}
