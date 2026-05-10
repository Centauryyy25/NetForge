import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { db } from "@/db";
import { customers } from "@/db/schema/customers";
import { requireRole } from "@/lib/auth-guard";
import { withErrorHandler } from "@/lib/api-handler";
import { inArray } from "drizzle-orm";
import { enqueueSuspendPPPoE, enqueueActivatePPPoE } from "@/lib/queue/producer";

const bulkSchema = z.object({
  action: z.enum(["suspend", "activate"]),
  customerIds: z.array(z.number().int().positive()).min(1).max(50),
});

export const POST = withErrorHandler(async (req) => {
  await requireRole(["admin", "operator"]);

  const body = await req.json();
  const result = bulkSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validation Error", details: result.error.format() },
      { status: 400 }
    );
  }

  const { action, customerIds } = result.data;
  const newStatus =
    action === "suspend" ? ("suspended" as const) : ("active" as const);

  const affected = await db.query.customers.findMany({
    where: inArray(customers.id, customerIds),
    columns: { id: true, pppoeUsername: true, status: true },
  });

  await db
    .update(customers)
    .set({ status: newStatus, updatedAt: new Date() })
    .where(inArray(customers.id, customerIds));

  const jobIds: string[] = [];
  for (const customer of affected) {
    if (!customer.pppoeUsername) continue;
    if (customer.status === newStatus) continue;

    const job =
      action === "suspend"
        ? await enqueueSuspendPPPoE({ username: customer.pppoeUsername })
        : await enqueueActivatePPPoE({ username: customer.pppoeUsername });

    if (job.id) jobIds.push(job.id);
  }

  return NextResponse.json({
    success: true,
    processed: affected.length,
    jobIds,
  });
});
