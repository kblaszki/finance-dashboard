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

export function forbidden(message: string): HttpError {
  return new HttpError(403, message);
}

export function conflict(message: string): HttpError {
  return new HttpError(409, message);
}

export function handleRouteError(res: Response, error: unknown, fallback: string): void {
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  if (error instanceof Error) {
    // eslint-disable-next-line no-console
    console.error(fallback, error.message);
  }
  res.status(500).json({ error: fallback });
}
