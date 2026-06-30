import { apiClient } from "./client";

export type DocumentAttachment = {
  id: number;
  entityType: string;
  entityId: number;
  filename: string;
  mimeType: string | null;
  storageRef: string | null;
  description: string | null;
  uploadedAt: string;
};

export function fetchDocumentAttachments(opts?: { entityType?: string; entityId?: number }) {
  const params = new URLSearchParams();
  if (opts?.entityType) params.set("entityType", opts.entityType);
  if (opts?.entityId != null) params.set("entityId", String(opts.entityId));
  const q = params.toString() ? `?${params}` : "";
  return apiClient.get<DocumentAttachment[]>(`/api/document-attachments${q}`);
}

export function createDocumentAttachment(input: {
  entityType: string;
  entityId: number;
  filename: string;
  mimeType?: string | null;
  storageRef?: string | null;
  description?: string | null;
}) {
  return apiClient.post<DocumentAttachment>("/api/document-attachments", input);
}

export function deleteDocumentAttachment(id: number) {
  return apiClient.delete(`/api/document-attachments/${id}`);
}
