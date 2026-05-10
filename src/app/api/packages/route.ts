import { NextResponse } from "next/server";
import { db } from "@/db";
import { packages } from "@/db/schema/packages";
import { createPackageSchema } from "@/validators/package";
import { requireAuth, requireRole } from "@/lib/auth-guard";
import { withErrorHandler } from "@/lib/api-handler";

export const GET = withErrorHandler(async () => {
  await requireAuth();

  const data = await db.query.packages.findMany({
    orderBy: (packages, { desc }) => [desc(packages.createdAt)],
  });

  return NextResponse.json({ data });
});

export const POST = withErrorHandler(async (req) => {
  await requireRole(["admin"]);

  const body = await req.json();
  const result = createPackageSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validation Error", details: result.error.format() },
      { status: 400 }
    );
  }

  const newPackage = await db
    .insert(packages)
    .values({
      name: result.data.name,
      speed: result.data.speed,
      price: result.data.price.toString(),
      queueTarget:
        result.data.queueTarget === "" ? null : result.data.queueTarget,
      isActive: result.data.isActive,
    })
    .returning();

  return NextResponse.json({ data: newPackage[0] }, { status: 201 });
});
