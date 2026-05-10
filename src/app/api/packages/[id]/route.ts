import { NextResponse } from "next/server";
import { db } from "@/db";
import { packages } from "@/db/schema/packages";
import { createPackageSchema } from "@/validators/package";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "@/lib/auth-guard";
import { withErrorHandler } from "@/lib/api-handler";

export const GET = withErrorHandler<{ id: string }>(async (_req, { params }) => {
  await requireAuth();

  const { id } = await params;
  const packageId = parseInt(id);
  if (isNaN(packageId)) {
    return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
  }

  const pkg = await db.query.packages.findFirst({
    where: eq(packages.id, packageId),
  });
  if (!pkg) {
    return NextResponse.json({ error: "Package not found" }, { status: 404 });
  }

  return NextResponse.json({ data: pkg });
});

export const PATCH = withErrorHandler<{ id: string }>(async (req, { params }) => {
  await requireRole(["admin"]);

  const { id } = await params;
  const packageId = parseInt(id);
  if (isNaN(packageId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const body = await req.json();
  const result = createPackageSchema.partial().safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validation Error", details: result.error.format() },
      { status: 400 }
    );
  }

  const updated = await db
    .update(packages)
    .set({
      ...result.data,
      price: result.data.price?.toString(),
      queueTarget:
        result.data.queueTarget === "" ? null : result.data.queueTarget,
    })
    .where(eq(packages.id, packageId))
    .returning();

  if (!updated.length) {
    return NextResponse.json({ error: "Package not found" }, { status: 404 });
  }

  return NextResponse.json({ data: updated[0] });
});

export const DELETE = withErrorHandler<{ id: string }>(async (_req, { params }) => {
  await requireRole(["admin"]);

  const { id } = await params;
  const packageId = parseInt(id);
  if (isNaN(packageId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  try {
    const deleted = await db
      .delete(packages)
      .where(eq(packages.id, packageId))
      .returning();

    if (!deleted.length) {
      return NextResponse.json({ error: "Package not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: deleted[0] });
  } catch {
    return NextResponse.json(
      { error: "Cannot delete package. It may be assigned to customers." },
      { status: 409 }
    );
  }
});
