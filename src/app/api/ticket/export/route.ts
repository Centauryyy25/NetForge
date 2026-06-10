import { requireRole } from "@/lib/auth-guard";
import { withErrorHandler } from "@/lib/api-handler";
import { parseTicketFilters, getFilteredTickets } from "@/lib/ticket-queries";
import {
  REQUEST_TYPE_LABELS,
  REQUEST_STATUS_LABELS,
  TICKET_PRIORITY_LABELS,
} from "@/lib/constants";

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatDate(date: Date | null): string {
  if (!date) return "";
  return date.toISOString().replace("T", " ").slice(0, 19);
}

export const GET = withErrorHandler(async (req) => {
  await requireRole(["admin", "operator"]);

  const url = new URL(req.url);
  const rawParams: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    rawParams[key] = value;
  });
  const filters = parseTicketFilters(rawParams);

  const tickets = await getFilteredTickets(filters);

  const headers = [
    "No Tiket",
    "Judul",
    "Tipe",
    "Nama",
    "Telepon",
    "Prioritas",
    "Status",
    "SLA Deadline",
    "Diselesaikan",
    "Handler",
    "Dibuat",
    "Diperbarui",
  ];

  const rows = tickets.map((t) => [
    t.ticketNumber,
    t.subject,
    REQUEST_TYPE_LABELS[t.type as keyof typeof REQUEST_TYPE_LABELS] ?? t.type,
    t.name,
    t.phone,
    TICKET_PRIORITY_LABELS[t.priority as keyof typeof TICKET_PRIORITY_LABELS] ?? t.priority,
    REQUEST_STATUS_LABELS[t.status as keyof typeof REQUEST_STATUS_LABELS] ?? t.status,
    formatDate(t.slaDeadline),
    formatDate(t.resolvedAt),
    t.handler?.name ?? "",
    formatDate(t.createdAt),
    formatDate(t.updatedAt),
  ]);

  const csv = [
    headers.map(escapeCsv).join(","),
    ...rows.map((row) => row.map(escapeCsv).join(",")),
  ].join("\n");

  const today = new Date().toISOString().split("T")[0];

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tiket-ybynet-${today}.csv"`,
    },
  });
});
