import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { withErrorHandler } from "@/lib/api-handler";
import { markOverduePayments } from "@/lib/billing/overdue";

export const POST = withErrorHandler(async () => {
  await requireRole(["admin", "operator"]);

  const updatedCount = await markOverduePayments();

  return NextResponse.json({
    data: { updatedCount },
    message: `${updatedCount} tagihan ditandai sebagai tunggakan`,
  });
});
