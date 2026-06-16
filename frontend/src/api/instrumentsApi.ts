import { apiClient } from "./client";

export type Instrument = {
  id: number;
  instrumentType: string;
  symbol: string;
  name: string | null;
  exchange: string | null;
  currency: string;
  source: string;
  createdAt: string;
};

export type InstrumentInput = {
  instrumentType: string;
  symbol: string;
  name?: string;
  exchange?: string | null;
  currency: string;
  source?: string;
};

export async function fetchInstruments(q?: string): Promise<Instrument[]> {
  const params = q ? `?q=${encodeURIComponent(q)}` : "";
  return apiClient.get<Instrument[]>(`/api/instruments${params}`);
}

export async function createInstrument(input: InstrumentInput): Promise<Instrument> {
  return apiClient.post<Instrument>("/api/instruments", input);
}
