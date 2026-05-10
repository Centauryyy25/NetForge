import { sql } from "drizzle-orm";
import { db } from "@/db";

export async function nextCustomerNumber(): Promise<string> {
  const rows = await db.execute<{ nextval: string | number }>(
    sql`SELECT nextval('yby_customer_seq') AS nextval`
  );
  const num = Number(rows[0]?.nextval);
  return `YBY-${String(num).padStart(5, "0")}`;
}

async function nextNumberForScope(scope: string): Promise<number> {
  const rows = await db.execute<{ value: string | number }>(sql`
    INSERT INTO counters (scope, value)
    VALUES (${scope}, 1)
    ON CONFLICT (scope)
    DO UPDATE SET value = counters.value + 1
    RETURNING value
  `);
  return Number(rows[0]?.value);
}

function currentMonthScope(prefix: string, now = new Date()): string {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  return `${prefix}:${yyyy}-${mm}`;
}

export async function nextInvoiceNumber(now = new Date()): Promise<string> {
  const scope = currentMonthScope("invoice", now);
  const num = await nextNumberForScope(scope);
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  return `INV-${yyyy}-${mm}-${String(num).padStart(4, "0")}`;
}

export async function nextTicketNumber(now = new Date()): Promise<string> {
  const scope = currentMonthScope("ticket", now);
  const num = await nextNumberForScope(scope);
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  return `TKT-${yyyy}-${mm}-${String(num).padStart(4, "0")}`;
}

export const __test = { nextNumberForScope, currentMonthScope };
