import { db } from "@/db";
import { serviceRequests, users } from "@/db/schema";
import { and, eq, gte, lte, inArray, ilike, isNotNull, isNull, sql, not } from "drizzle-orm";
import type { RequestStatus, RequestType, TicketPriority } from "@/lib/constants";

// ── Types ──

export interface TicketFilters {
  search?: string;
  status?: RequestStatus[];
  priority?: TicketPriority[];
  type?: RequestType[];
  slaStatus?: SlaStatus[];
  handledBy?: number;
  dateFrom?: string;
  dateTo?: string;
}

export type SlaStatus = "on_track" | "breached" | "paused";

export interface TicketSummaryData {
  total: number;
  open: number;
  breached: number;
  avgResolutionMs: number | null;
}

export interface HandlerOption {
  id: number;
  name: string;
}

// ── Parse URL search params into typed filters ──

export function parseTicketFilters(
  params: Record<string, string | string[] | undefined>,
): TicketFilters {
  const getString = (key: string): string | undefined => {
    const v = params[key];
    if (Array.isArray(v)) return v[0];
    return v || undefined;
  };

  const getArray = (key: string): string[] | undefined => {
    const v = getString(key);
    if (!v) return undefined;
    return v.split(",").filter(Boolean);
  };

  const filters: TicketFilters = {};

  const search = getString("search");
  if (search) filters.search = search;

  const status = getArray("status") as RequestStatus[] | undefined;
  if (status?.length) filters.status = status;

  const priority = getArray("priority") as TicketPriority[] | undefined;
  if (priority?.length) filters.priority = priority;

  const type = getArray("type") as RequestType[] | undefined;
  if (type?.length) filters.type = type;

  const slaStatus = getArray("slaStatus") as SlaStatus[] | undefined;
  if (slaStatus?.length) filters.slaStatus = slaStatus;

  const handledBy = getString("handledBy");
  if (handledBy) filters.handledBy = Number(handledBy);

  const dateFrom = getString("dateFrom");
  if (dateFrom) filters.dateFrom = dateFrom;

  const dateTo = getString("dateTo");
  if (dateTo) filters.dateTo = dateTo;

  return filters;
}

// ── Summary stats (global, not affected by filters) ──

export async function getTicketSummary(): Promise<TicketSummaryData> {
  const closedStatuses = ["resolved", "closed"] as const;

  const [totalResult, openResult, breachedResult, avgResult] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(serviceRequests),

    db.select({ count: sql<number>`count(*)::int` })
      .from(serviceRequests)
      .where(inArray(serviceRequests.status, ["open", "in_progress"])),

    db.select({ count: sql<number>`count(*)::int` })
      .from(serviceRequests)
      .where(
        and(
          isNotNull(serviceRequests.slaDeadline),
          sql`${serviceRequests.slaDeadline} < now()`,
          not(inArray(serviceRequests.status, [...closedStatuses])),
          isNull(serviceRequests.slaPausedAt),
        ),
      ),

    db.select({
      avg: sql<number | null>`
        EXTRACT(EPOCH FROM avg(${serviceRequests.resolvedAt} - ${serviceRequests.createdAt})) * 1000
      `,
    })
      .from(serviceRequests)
      .where(
        and(
          isNotNull(serviceRequests.resolvedAt),
          inArray(serviceRequests.status, [...closedStatuses]),
        ),
      ),
  ]);

  return {
    total: totalResult[0].count,
    open: openResult[0].count,
    breached: breachedResult[0].count,
    avgResolutionMs: avgResult[0].avg ? Number(avgResult[0].avg) : null,
  };
}

// ── Filtered ticket list ──

export async function getFilteredTickets(filters: TicketFilters) {
  const conditions = [];

  if (filters.search) {
    conditions.push(ilike(serviceRequests.subject, `%${filters.search}%`));
  }

  if (filters.status?.length) {
    conditions.push(inArray(serviceRequests.status, filters.status));
  }

  if (filters.priority?.length) {
    conditions.push(inArray(serviceRequests.priority, filters.priority));
  }

  if (filters.type?.length) {
    conditions.push(inArray(serviceRequests.type, filters.type));
  }

  if (filters.handledBy) {
    conditions.push(eq(serviceRequests.handledBy, filters.handledBy));
  }

  if (filters.dateFrom) {
    conditions.push(gte(serviceRequests.createdAt, new Date(filters.dateFrom)));
  }

  if (filters.dateTo) {
    // Include the entire end date by setting to end of day
    const endDate = new Date(filters.dateTo);
    endDate.setHours(23, 59, 59, 999);
    conditions.push(lte(serviceRequests.createdAt, endDate));
  }

  if (filters.slaStatus?.length) {
    const slaConditions = [];
    const closedStatuses = ["resolved", "closed"] as const;

    for (const s of filters.slaStatus) {
      switch (s) {
        case "breached":
          slaConditions.push(
            and(
              isNotNull(serviceRequests.slaDeadline),
              sql`${serviceRequests.slaDeadline} < now()`,
              not(inArray(serviceRequests.status, [...closedStatuses])),
              isNull(serviceRequests.slaPausedAt),
            ),
          );
          break;
        case "paused":
          slaConditions.push(isNotNull(serviceRequests.slaPausedAt));
          break;
        case "on_track":
          slaConditions.push(
            and(
              isNotNull(serviceRequests.slaDeadline),
              sql`${serviceRequests.slaDeadline} >= now()`,
              not(inArray(serviceRequests.status, [...closedStatuses])),
              isNull(serviceRequests.slaPausedAt),
            ),
          );
          break;
      }
    }

    if (slaConditions.length === 1) {
      conditions.push(slaConditions[0]!);
    } else if (slaConditions.length > 1) {
      // OR between SLA statuses
      conditions.push(sql`(${sql.join(slaConditions.map(c => sql`(${c})`), sql` OR `)})`);
    }
  }

  return db.query.serviceRequests.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    with: { customer: true, handler: true },
    orderBy: (sr, { desc }) => [desc(sr.createdAt)],
  });
}

// ── Handler options for filter dropdown ──

export async function getHandlerOptions(): Promise<HandlerOption[]> {
  const result = await db
    .select({
      id: users.id,
      name: users.name,
    })
    .from(users)
    .innerJoin(serviceRequests, eq(serviceRequests.handledBy, users.id))
    .groupBy(users.id, users.name)
    .orderBy(users.name);

  return result;
}
