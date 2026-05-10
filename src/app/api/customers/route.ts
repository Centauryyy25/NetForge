import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { customers } from "@/db/schema/customers";
import { packages } from "@/db/schema/packages";
import { createCustomerSchema } from "@/validators/customer";
import { auth } from "@/lib/auth";
import { generateCustomerId } from "@/lib/utils";
import { generatePPPoEPassword } from "@/lib/crypto/password";
import { enqueueCreatePPPoE } from "@/lib/queue/producer";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await db.query.customers.findMany({
      with: {
        package: true,
      },
      orderBy: (customers, { desc }) => [desc(customers.createdAt)],
    });
    
    return NextResponse.json({ data });
  } catch (error) {
    console.error("GET /api/customers error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session || (session.user.role !== "admin" && session.user.role !== "operator")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const result = createCustomerSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation Error", details: result.error.format() },
        { status: 400 }
      );
    }

    const data = result.data;

    const customerId = generateCustomerId();
    const now = new Date();
    const activeUntil = new Date(now);
    activeUntil.setMonth(now.getMonth() + 1);

    const plainPppoePassword = data.pppoeUsername
      ? generatePPPoEPassword()
      : null;
    const pppoePasswordHash = plainPppoePassword
      ? await bcrypt.hash(plainPppoePassword, 10)
      : null;

    const newCustomer = await db
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
      const pkg = await db.query.packages.findFirst({
        where: eq(packages.id, data.packageId),
      });

      const profileName = pkg ? pkg.name.replace(/\s+/g, "-") : "default";

      await enqueueCreatePPPoE({
        username: data.pppoeUsername,
        password: plainPppoePassword,
        profile: profileName,
        triggeredBy: parseInt(session.user.id),
      });
    }

    return NextResponse.json({ data: newCustomer[0] }, { status: 201 });
  } catch (error) {
    console.error("POST /api/customers error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
