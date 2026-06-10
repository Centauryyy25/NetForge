import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ServiceRequestTable, type ServiceRequestRow } from "@/components/tables/service-request-table";
import { TicketSummaryCards } from "@/components/ticket/ticket-summary-cards";
import { TicketFilters } from "@/components/ticket/ticket-filters";
import { auth } from "@/lib/auth";
import {
  parseTicketFilters,
  getTicketSummary,
  getFilteredTickets,
  getHandlerOptions,
} from "@/lib/ticket-queries";

export const metadata: Metadata = {
  title: "Tiket Layanan",
};

export const dynamic = "force-dynamic";

export default async function TicketPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();
  const userRole = session?.user?.role ?? "technician";

  const params = await searchParams;
  const filters = parseTicketFilters(params as Record<string, string | string[] | undefined>);

  const [summary, requests, handlers] = await Promise.all([
    getTicketSummary(),
    getFilteredTickets(filters),
    getHandlerOptions(),
  ]);

  const formattedData: ServiceRequestRow[] = requests.map(req => ({
    id: req.id,
    ticketNumber: req.ticketNumber,
    subject: req.subject,
    type: req.type as ServiceRequestRow["type"],
    name: req.name ?? "",
    phone: req.phone ?? "-",
    status: req.status as ServiceRequestRow["status"],
    priority: req.priority as ServiceRequestRow["priority"],
    slaDeadline: req.slaDeadline?.toISOString() ?? null,
    resolvedAt: req.resolvedAt?.toISOString() ?? null,
    createdAt: req.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tiket Layanan</h1>
          <p className="text-muted-foreground">
            Kelola tiket ajuan dan gangguan pelanggan
          </p>
        </div>
        {(userRole === "admin" || userRole === "operator") && (
          <Button render={<Link href="/ticket/new" />}>
            <Plus className="mr-2 h-4 w-4" />
            Buat Tiket
          </Button>
        )}
      </div>
      <TicketSummaryCards data={summary} />
      <TicketFilters handlers={handlers} />
      <ServiceRequestTable data={formattedData} userRole={userRole} />
    </div>
  );
}
