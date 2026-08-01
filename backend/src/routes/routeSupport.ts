import type { AuthedRequest } from "../auth";

export function uid(req: AuthedRequest): number {
  return req.userId!;
}
