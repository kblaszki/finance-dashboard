import type { AuthedRequest } from "../auth";
import { unauthorized } from "../lib/errors";

export function uid(req: AuthedRequest): number {
  if (req.userId == null) throw unauthorized("Unauthorized");
  return req.userId;
}
