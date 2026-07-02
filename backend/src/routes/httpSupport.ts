import {
  HttpError,
  badRequest,
  forbidden,
  notFound,
  unauthorized,
  handleRouteError,
} from "../lib/errors";

export {
  HttpError,
  badRequest,
  forbidden,
  notFound,
  unauthorized,
  handleRouteError,
};

export function parseIdParam(value: unknown, field = "id"): number {
  return parseFiniteNumber(value, field, { min: 1 });
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
