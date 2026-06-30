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

export type InstrumentValuation = {
  id: number;
  instrumentId: number;
  valuationDate: string;
  price: number;
  currency: string;
  source: string;
};

export type InstrumentValuationInput = {
  valuationDate: string;
  price: number;
  currency?: string;
  source?: string;
};

type ValuationQuery = {
  from?: string;
  to?: string;
};

function valuationQuery(params?: ValuationQuery): string {
  if (!params) return "";
  const q = new URLSearchParams();
  if (params.from) q.set("from", params.from);
  if (params.to) q.set("to", params.to);
  const s = q.toString();
  return s ? `?${s}` : "";
}

export async function fetchInstruments(q?: string): Promise<Instrument[]> {
  const params = q ? `?q=${encodeURIComponent(q)}` : "";
  return apiClient.get<Instrument[]>(`/api/instruments${params}`);
}

export async function fetchInstrument(id: number): Promise<Instrument> {
  return apiClient.get<Instrument>(`/api/instruments/${id}`);
}

export async function createInstrument(input: InstrumentInput): Promise<Instrument> {
  return apiClient.post<Instrument>("/api/instruments", input);
}

export async function fetchInstrumentValuations(
  instrumentId: number,
  params?: ValuationQuery,
): Promise<InstrumentValuation[]> {
  return apiClient.get<InstrumentValuation[]>(
    `/api/instruments/${instrumentId}/valuations${valuationQuery(params)}`,
  );
}

export async function createInstrumentValuation(
  instrumentId: number,
  input: InstrumentValuationInput,
): Promise<InstrumentValuation> {
  return apiClient.post<InstrumentValuation>(
    `/api/instruments/${instrumentId}/valuations`,
    input,
  );
}
