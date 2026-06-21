import type { Response } from "express";

export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function badRequest(message: string): HttpError {
  return new HttpError(400, message);
}

export function notFound(message: string): HttpError {
  return new HttpError(404, message);
}

export function unauthorized(message: string): HttpError {
  return new HttpError(401, message);
}

export function handleRouteError(res: Response, error: unknown, fallback: string): void {
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  const msg = error instanceof Error ? error.message : fallback;
  res.status(500).json({ error: msg });
}

export function parseRequiredString(value: unknown, field: string): string {
  const text = String(value ?? "").trim();
  if (!text) throw badRequest(`${field} required`);
  return text;
}

export function parseFiniteNumber(
  value: unknown,
  field: string,
  options: { min?: number } = {},
): number {
  const n = Number(value);
  const min = options.min ?? Number.NEGATIVE_INFINITY;
  if (!Number.isFinite(n) || n < min) {
    throw badRequest(`${field} must be a valid number`);
  }
  return n;
}

export function parsePositiveNumber(value: unknown, field: string): number {
  return parseFiniteNumber(value, field, { min: Number.MIN_VALUE });
}
