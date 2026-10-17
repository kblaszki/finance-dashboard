import { apiClient } from "./client";

export type Tag = {
  id: number;
  name: string;
  createdAt: string;
};

export type CreateTagInput = {
  name: string;
};

export type UpdateTagInput = {
  name: string;
};

export async function fetchTags(): Promise<Tag[]> {
  return apiClient.get<Tag[]>("/api/tags");
}

export async function createTag(input: CreateTagInput): Promise<Tag> {
  return apiClient.post<Tag>("/api/tags", input);
}

export async function updateTag(id: number, input: UpdateTagInput): Promise<Tag> {
  return apiClient.patch<Tag>(`/api/tags/${id}`, input);
}

export async function deleteTag(id: number): Promise<void> {
  await apiClient.delete(`/api/tags/${id}`);
}
