import { pgTable, serial, varchar, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { customers } from "./customers";
import { users } from "./users";

export const requestTypeEnum = pgEnum("request_type", [
  "new_installation",
  "upgrade_downgrade",
  "trouble_ticket",
  "relocation",
  "unsubscribe",
]);

export const requestStatusEnum = pgEnum("request_status", [
  "open",
  "in_progress",
  "pending",
  "approved",
  "rejected",
  "resolved",
  "closed",
]);

export const ticketPriorityEnum = pgEnum("ticket_priority", [
  "low",
  "medium",
  "high",
  "critical",
]);

export const serviceRequests = pgTable("service_requests", {
  id: serial("id").primaryKey(),
  ticketNumber: varchar("ticket_number", { length: 30 }).notNull().unique(), // e.g. TKT-2603-0001
  subject: varchar("subject", { length: 255 }).notNull(),
  type: requestTypeEnum("type").notNull(),
  customerId: integer("customer_id").references(() => customers.id),
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  description: text("description").notNull(),
  status: requestStatusEnum("status").notNull().default("open"),
  priority: ticketPriorityEnum("priority").notNull().default("medium"),
  adminNotes: text("admin_notes"),
  handledBy: integer("handled_by").references(() => users.id),
  slaDeadline: timestamp("sla_deadline"),
  slaPausedAt: timestamp("sla_paused_at"),
  escalatedAt: timestamp("escalated_at"),
  massOutageTag: varchar("mass_outage_tag", { length: 100 }),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
