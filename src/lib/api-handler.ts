import { NextResponse } from "next/server";
import { ForbiddenError, UnauthorizedError } from "@/lib/auth-guard";

type RouteHandler<P> = (
  req: Request,
  ctx: { params: Promise<P> }
) => Promise<Response>;

export function withErrorHandler<P = Record<string, never>>(
  handler: RouteHandler<P>
): RouteHandler<P> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
      if (error instanceof ForbiddenError) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      console.error("[api]", error);
      return NextResponse.json(
        { error: "Internal Server Error" },
        { status: 500 }
      );
    }
  };
}
