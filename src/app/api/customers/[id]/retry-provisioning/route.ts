import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { customers } from "@/db/schema/customers";
import { packages } from "@/db/schema/packages";
import { auth } from "@/lib/auth";
import { generatePPPoEPassword } from "@/lib/crypto/password";
import { enqueueCreatePPPoE } from "@/lib/queue/producer";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (
      !session ||
      (session.user.role !== "admin" && session.user.role !== "operator")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const customerId = parseInt(id);
    if (isNaN(customerId)) {
      return NextResponse.json(
        { error: "Invalid ID format" },
        { status: 400 }
      );
    }

    const customer = await db.query.customers.findFirst({
      where: eq(customers.id, customerId),
    });
    if (!customer) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }
    if (customer.status !== "provisioning_failed") {
      return NextResponse.json(
        { error: "Customer is not in provisioning_failed state" },
        { status: 409 }
      );
    }
    if (!customer.pppoeUsername) {
      return NextResponse.json(
        { error: "Customer has no PPPoE username" },
        { status: 422 }
      );
    }

    const pkg = await db.query.packages.findFirst({
      where: eq(packages.id, customer.packageId),
    });
    const profileName = pkg ? pkg.name.replace(/\s+/g, "-") : "default";

    const plainPassword = generatePPPoEPassword();
    const hash = await bcrypt.hash(plainPassword, 10);

    await db.transaction(async (tx) => {
      await tx
        .update(customers)
        .set({
          pppoePasswordHash: hash,
          status: "active",
          updatedAt: new Date(),
        })
        .where(eq(customers.id, customerId));

      await enqueueCreatePPPoE({
        customerId,
        username: customer.pppoeUsername!,
        password: plainPassword,
        profile: profileName,
        triggeredBy: parseInt(session.user.id),
      });
    });

    return NextResponse.json({ data: { customerId, requeued: true } });
  } catch (error) {
    console.error("POST /api/customers/[id]/retry-provisioning error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
