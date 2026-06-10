"use client";

import { Pause } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { isSlaBreached, slaRemainingMs } from "@/lib/sla";
import { SLA_HOURS, type TicketPriority } from "@/lib/constants";

interface SlaBadgeProps {
  slaDeadline: string | null;
  resolvedAt: string | null;
  priority?: TicketPriority;
  paused?: boolean;
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return "Terlewati";
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}h ${hours % 24}j sisa`;
  }
  return `${hours}j ${minutes}m sisa`;
}

export function SlaBadge({ slaDeadline, resolvedAt, priority = "medium", paused = false }: SlaBadgeProps) {
  if (!slaDeadline) {
    return <Badge variant="secondary" className="bg-muted/70 text-muted-foreground">Tanpa SLA</Badge>;
  }

  // Paused state — SLA clock is frozen
  if (paused) {
    return (
      <Badge variant="secondary" className="bg-orange-500/85 text-white">
        <Pause className="mr-1 h-3 w-3" />
        SLA Dijeda
      </Badge>
    );
  }

  const deadline = new Date(slaDeadline);
  const resolved = resolvedAt ? new Date(resolvedAt) : null;
  const breached = isSlaBreached(deadline, resolved);
  const remainingMs = slaRemainingMs(deadline);
  const totalMs = SLA_HOURS[priority] * 60 * 60 * 1000;

  if (breached) {
    return (
      <Badge variant="secondary" className="bg-destructive/85 text-destructive-foreground">
        SLA Terlewati
      </Badge>
    );
  }

  if (resolved) {
    return (
      <Badge variant="secondary" className="bg-success/85 text-success-foreground">
        Selesai (dalam SLA)
      </Badge>
    );
  }

  // Warning: less than 25% time remaining
  const isWarning = remainingMs !== null && remainingMs < totalMs * 0.25;

  return (
    <Badge
      variant="secondary"
      className={isWarning ? "bg-warning/85 text-warning-foreground" : "bg-success/85 text-success-foreground"}
    >
      {remainingMs !== null ? formatRemaining(remainingMs) : "—"}
    </Badge>
  );
}
