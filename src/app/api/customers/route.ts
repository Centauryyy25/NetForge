import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { customers } from "@/db/schema/customers";
import { packages } from "@/db/schema/packages";
import { createCustomerSchema } from "@/validators/customer";
import { requireAuth, requireRole } from "@/lib/auth-guard";
import { withErrorHandler } from "@/lib/api-handler";
import { nextCustomerNumber } from "@/lib/ids";
import { generatePPPoEPassword } from "@/lib/crypto/password";
import { enqueueCreatePPPoE } from "@/lib/queue/producer";
import { eq } from "drizzle-orm";

export const GET = withErrorHandler(async () => {
  await requireAuth();

  const data = await db.query.customers.findMany({
    with: { package: true },
    orderBy: (customers, { desc }) => [desc(customers.createdAt)],
  });

  return NextResponse.json({ data });
});

export const POST = withErrorHandler(async (req) => {
  const session = await requireRole(["admin", "operator"]);

  const body = await req.json();
  const result = createCustomerSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validation Error", details: result.error.format() },
      { status: 400 }
    );
  }

  const data = result.data;

  const customerId = await nextCustomerNumber();
  const now = new Date();
  const activeUntil = new Date(now);
  activeUntil.setMonth(now.getMonth() + 1);

  const plainPppoePassword = data.pppoeUsername
    ? generatePPPoEPassword()
    : null;
  const pppoePasswordHash = plainPppoePassword
    ? await bcrypt.hash(plainPppoePassword, 10)
    : null;

  let profileName = "default";
  if (data.pppoeUsername) {
    const pkg = await db.query.packages.findFirst({
      where: eq(packages.id, data.packageId),
    });
    profileName = pkg ? pkg.name.replace(/\s+/g, "-") : "default";
  }

  const newCustomer = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(customers)
      .values({
        customerId,
        name: data.name,
        address: data.address,
        phone: data.phone,
        email: data.email || null,
        nik: data.nik || null,
        packageId: data.packageId,
        registrationDate: now.toISOString().split("T")[0],
        activeUntil: activeUntil.toISOString().split("T")[0],
        status: "active",
        pppoeUsername: data.pppoeUsername || null,
        pppoePasswordHash,
        onuSn: data.onuSn || null,
        notes: data.notes || null,
      })
      .returning();

    if (data.pppoeUsername && plainPppoePassword) {
      await enqueueCreatePPPoE({
        customerId: row.id,
        username: data.pppoeUsername,
        password: plainPppoePassword,
        profile: profileName,
        triggeredBy: parseInt(session.user.id),
      });
    }

    return row;
  });

  return NextResponse.json({ data: newCustomer }, { status: 201 });
});
