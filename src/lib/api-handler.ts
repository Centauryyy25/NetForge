import { NextResponse } from "next/server";
import { ForbiddenError, UnauthorizedError } from "@/lib/auth-guard";
import { apiLogger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";

type RouteHandler<P> = (
  req: Request,
  ctx: { params: Promise<P> }
) => Promise<Response>;

export function withErrorHandler<P = Record<string, never>>(
  handler: RouteHandler<P>
): RouteHandler<P> {
  return async (req, ctx) => {
    const rateLimitResponse = checkRateLimit(req);
    if (rateLimitResponse) {
      apiLogger.warn({ url: req.url, method: req.method }, "rate limit exceeded");
      return rateLimitResponse;
    }

    try {
      return await handler(req, ctx);
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
      if (error instanceof ForbiddenError) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      apiLogger.error({ err: error, url: req.url, method: req.method }, "unhandled error");
      return NextResponse.json(
        { error: "Internal Server Error" },
        { status: 500 }
      );
    }
  };
}
