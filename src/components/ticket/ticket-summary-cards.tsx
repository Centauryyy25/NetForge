import { Ticket, CircleDot, AlertTriangle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TicketSummaryData } from "@/lib/ticket-queries";

function formatDuration(ms: number | null): string {
  if (ms == null) return "-";
  const totalMinutes = Math.round(ms / 60_000);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 24) return minutes > 0 ? `${hours}j ${minutes}m` : `${hours}j`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days}h ${remainingHours}j` : `${days}h`;
}

interface TicketSummaryCardsProps {
  data: TicketSummaryData;
}

export function TicketSummaryCards({ data }: TicketSummaryCardsProps) {
  const cards = [
    {
      title: "Total Tiket",
      value: data.total,
      icon: Ticket,
      description: "Semua tiket terdaftar",
      className: "",
    },
    {
      title: "Tiket Terbuka",
      value: data.open,
      icon: CircleDot,
      description: "Belum ditangani / diproses",
      className: "",
    },
    {
      title: "Breach SLA",
      value: data.breached,
      icon: AlertTriangle,
      description: "Melewati batas waktu SLA",
      className: data.breached > 0
        ? "border-destructive/50 bg-destructive/5"
        : "",
    },
    {
      title: "Rata-rata Resolusi",
      value: formatDuration(data.avgResolutionMs),
      icon: Clock,
      description: "Waktu penyelesaian tiket",
      className: "",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card
          key={card.title}
          className={`transition-all duration-300 hover:-translate-y-1 ${card.className}`}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <card.icon className={`h-4 w-4 ${
              card.title === "Breach SLA" && data.breached > 0
                ? "text-destructive"
                : "text-muted-foreground"
            }`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${
              card.title === "Breach SLA" && data.breached > 0
                ? "text-destructive"
                : ""
            }`}>
              {card.value}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {card.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
