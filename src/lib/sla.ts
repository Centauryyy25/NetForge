import { SLA_HOURS, type TicketPriority } from "@/lib/constants";

export function calculateSlaDeadline(createdAt: Date, priority: TicketPriority): Date {
  const deadline = new Date(createdAt);
  deadline.setHours(deadline.getHours() + SLA_HOURS[priority]);
  return deadline;
}

export function isSlaBreached(slaDeadline: Date | null, resolvedAt: Date | null): boolean {
  if (!slaDeadline) return false;
  const compareTime = resolvedAt ?? new Date();
  return compareTime > slaDeadline;
}

export function slaRemainingMs(slaDeadline: Date | null): number | null {
  if (!slaDeadline) return null;
  return slaDeadline.getTime() - Date.now();
}

/**
 * Extend the SLA deadline by the duration the ticket was paused.
 * Called when a ticket transitions OUT of "pending" status.
 */
export function extendDeadlineAfterPause(
  currentDeadline: Date | null,
  pausedAt: Date | null,
): Date | null {
  if (!currentDeadline || !pausedAt) return currentDeadline;
  const pauseDurationMs = Date.now() - pausedAt.getTime();
  if (pauseDurationMs <= 0) return currentDeadline;
  return new Date(currentDeadline.getTime() + pauseDurationMs);
}
