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

function clientErrorStatus(error: unknown): number | null {
  if (error instanceof HttpError) return error.status;
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status?: unknown }).status;
    if (typeof status === "number" && status >= 400 && status < 500) return status;
  }
  return null;
}

export function handleRouteError(res: Response, error: unknown, fallback: string): void {
  const status = clientErrorStatus(error);
  if (status !== null) {
    const message =
      error instanceof Error && error.message ? error.message : "Bad request";
    res.status(status).json({ error: message });
    return;
  }
  if (error instanceof Error) {
    if (process.env.NODE_ENV === "production") {
      // eslint-disable-next-line no-console
      console.error(fallback);
    } else {
      // eslint-disable-next-line no-console
      console.error(fallback, error.message);
    }
  }
  res.status(500).json({ error: fallback });
}
