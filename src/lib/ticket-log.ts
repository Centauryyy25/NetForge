import { db } from "@/db";
import { ticketLogs } from "@/db/schema/ticket-logs";

interface LogParams {
  ticketId: number;
  userId: number | null;
  action: string;
  detail: string;
  oldValue?: string | null;
  newValue?: string | null;
}

export async function logTicketAction({
  ticketId,
  userId,
  action,
  detail,
  oldValue,
  newValue,
}: LogParams) {
  await db.insert(ticketLogs).values({
    ticketId,
    userId,
    action,
    detail,
    oldValue: oldValue ?? null,
    newValue: newValue ?? null,
  });
}
