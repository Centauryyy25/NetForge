import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { SlaBadge } from "@/components/shared/sla-badge";
import { TicketUpdateForm } from "@/components/forms/ticket-update-form";
import { TicketCommandInput } from "@/components/forms/ticket-command-input";
import { TicketDeleteButton } from "@/components/forms/ticket-delete-button";
import { TicketTimeline } from "@/components/shared/ticket-timeline";
import { formatDate } from "@/lib/utils";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { serviceRequests } from "@/db/schema/service-requests";
import {
  REQUEST_TYPE_LABELS,
  TICKET_PRIORITY_LABELS,
  type RequestType,
  type TicketPriority,
} from "@/lib/constants";

export const metadata: Metadata = {
  title: "Detail Tiket",
};

export const dynamic = "force-dynamic";

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const userRole = session?.user?.role ?? "technician";

  const { id } = await params;
  const ticketId = parseInt(id);
  if (isNaN(ticketId)) notFound();

  const ticket = await db.query.serviceRequests.findFirst({
    where: eq(serviceRequests.id, ticketId),
    with: {
      customer: { columns: { id: true, name: true, customerId: true } },
      handler: { columns: { id: true, name: true } },
      logs: {
        with: { user: { columns: { id: true, name: true } } },
        orderBy: (logs, { desc }) => [desc(logs.createdAt)],
      },
    },
  });

  if (!ticket) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold tracking-tight">
            {ticket.subject}
          </h1>
          <StatusBadge status={ticket.status} type="request" />
          <StatusBadge status={ticket.priority} type="priority" />
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          <span className="font-mono">{ticket.ticketNumber}</span>
          {" — "}
          {REQUEST_TYPE_LABELS[ticket.type as RequestType]}
        </p>
      </div>

      {/* SLA Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">SLA</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <p className="text-sm text-muted-foreground">Status SLA</p>
              <SlaBadge
                slaDeadline={ticket.slaDeadline?.toISOString() ?? null}
                resolvedAt={ticket.resolvedAt?.toISOString() ?? null}
                priority={ticket.priority as TicketPriority}
                paused={ticket.status === "pending"}
              />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Prioritas</p>
              <p className="font-medium">
                {TICKET_PRIORITY_LABELS[ticket.priority as TicketPriority]}
              </p>
            </div>
            {ticket.slaDeadline && (
              <div>
                <p className="text-sm text-muted-foreground">Batas Waktu</p>
                <p className="font-medium text-sm">{formatDate(ticket.slaDeadline)}</p>
              </div>
            )}
            {ticket.slaPausedAt && (
              <div>
                <p className="text-sm text-muted-foreground">Dijeda Sejak</p>
                <p className="font-medium text-sm">{formatDate(ticket.slaPausedAt)}</p>
              </div>
            )}
            {ticket.escalatedAt && (
              <div>
                <p className="text-sm text-muted-foreground">Dieskalasi</p>
                <p className="font-medium text-sm">{formatDate(ticket.escalatedAt)}</p>
              </div>
            )}
            {ticket.massOutageTag && (
              <div>
                <p className="text-sm text-muted-foreground">Gangguan Massal</p>
                <Badge variant="outline">{ticket.massOutageTag}</Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Detail Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detail Pengajuan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Nama</p>
              <p className="font-medium">{ticket.name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Telepon</p>
              <p className="font-medium">{ticket.phone}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Dibuat</p>
              <p className="font-medium">{formatDate(ticket.createdAt)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Terakhir Update</p>
              <p className="font-medium">{formatDate(ticket.updatedAt)}</p>
            </div>
            {ticket.handler && (
              <div>
                <p className="text-sm text-muted-foreground">Ditangani Oleh</p>
                <p className="font-medium">{ticket.handler.name}</p>
              </div>
            )}
            {ticket.customer && (
              <div>
                <p className="text-sm text-muted-foreground">Pelanggan</p>
                <p className="font-medium">{ticket.customer.name}</p>
              </div>
            )}
          </div>
          <Separator />
          <div>
            <p className="text-sm text-muted-foreground mb-1">Deskripsi</p>
            <p className="text-sm whitespace-pre-wrap">{ticket.description}</p>
          </div>
          {ticket.adminNotes && (
            <div>
              <p className="text-sm text-muted-foreground mb-1">Catatan Admin</p>
              <p className="text-sm whitespace-pre-wrap">{ticket.adminNotes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Timeline / Riwayat */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Riwayat Aktivitas</CardTitle>
        </CardHeader>
        <CardContent>
          <TicketTimeline logs={ticket.logs} />
        </CardContent>
      </Card>

      {/* Command Input — admin & operator */}
      {(userRole === "admin" || userRole === "operator") && (
        <TicketCommandInput ticketId={ticket.id} />
      )}

      {/* Update Form — admin & operator */}
      {(userRole === "admin" || userRole === "operator") && (
        <TicketUpdateForm
          ticketId={ticket.id}
          currentStatus={ticket.status}
          currentPriority={ticket.priority}
          currentNotes={ticket.adminNotes}
        />
      )}

      {/* Delete — admin only */}
      {userRole === "admin" && (
        <TicketDeleteButton ticketId={ticket.id} ticketNumber={ticket.ticketNumber} />
      )}
    </div>
  );
}
