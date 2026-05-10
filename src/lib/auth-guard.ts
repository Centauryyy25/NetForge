import { auth } from "@/lib/auth";
import type { Role } from "@/lib/constants";
import type { Session } from "next-auth";

export class UnauthorizedError extends Error {
  constructor(message = "Not signed in") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export async function requireAuth(): Promise<Session> {
  const session = await auth();
  if (!session) throw new UnauthorizedError();
  return session;
}

export async function requireRole(allowed: Role[]): Promise<Session> {
  const session = await requireAuth();
  if (!allowed.includes(session.user.role)) {
    throw new ForbiddenError(`Requires role: ${allowed.join("|")}`);
  }
  return session;
}
