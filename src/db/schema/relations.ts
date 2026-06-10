import { relations } from "drizzle-orm";
import { users } from "./users";
import { packages } from "./packages";
import { customers } from "./customers";
import { payments } from "./payments";
import { serviceRequests } from "./service-requests";
import { activityLogs } from "./activity-logs";
import { ticketLogs } from "./ticket-logs";

// ── Users Relations ──
export const usersRelations = relations(users, ({ many }) => ({
  receivedPayments: many(payments),
  handledRequests: many(serviceRequests),
  ticketLogs: many(ticketLogs),
}));

// ── Packages Relations ──
export const packagesRelations = relations(packages, ({ many }) => ({
  customers: many(customers),
}));

// ── Customers Relations ──
export const customersRelations = relations(customers, ({ one, many }) => ({
  package: one(packages, {
    fields: [customers.packageId],
    references: [packages.id],
  }),
  payments: many(payments),
  serviceRequests: many(serviceRequests),
  activityLogs: many(activityLogs),
}));

// ── Payments Relations ──
export const paymentsRelations = relations(payments, ({ one }) => ({
  customer: one(customers, {
    fields: [payments.customerId],
    references: [customers.id],
  }),
  receiver: one(users, {
    fields: [payments.receivedBy],
    references: [users.id],
  }),
}));

// ── Service Requests Relations ──
export const serviceRequestsRelations = relations(serviceRequests, ({ one, many }) => ({
  customer: one(customers, {
    fields: [serviceRequests.customerId],
    references: [customers.id],
  }),
  handler: one(users, {
    fields: [serviceRequests.handledBy],
    references: [users.id],
  }),
  logs: many(ticketLogs),
}));

// ── Ticket Logs Relations ──
export const ticketLogsRelations = relations(ticketLogs, ({ one }) => ({
  ticket: one(serviceRequests, {
    fields: [ticketLogs.ticketId],
    references: [serviceRequests.id],
  }),
  user: one(users, {
    fields: [ticketLogs.userId],
    references: [users.id],
  }),
}));

// ── Activity Logs Relations ──
export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  customer: one(customers, {
    fields: [activityLogs.customerId],
    references: [customers.id],
  }),
}));
