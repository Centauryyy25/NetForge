import { pgTable, serial, varchar, decimal, text, integer, timestamp, date, pgEnum } from "drizzle-orm/pg-core";
import { customers } from "./customers";
import { users } from "./users";

export const paymentStatusEnum = pgEnum("payment_status", [
  "paid",
  "pending",
  "overdue",
  "cancelled",
]);

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  invoiceNumber: varchar("invoice_number", { length: 30 }).notNull().unique(), // e.g. INV-2603-00001
  customerId: integer("customer_id")
    .references(() => customers.id)
    .notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  paymentDate: date("payment_date").notNull(),
  paymentMethod: varchar("payment_method", { length: 20 }).notNull(), // cash, transfer, qris
  periodMonth: varchar("period_month", { length: 7 }).notNull(), // YYYY-MM
  status: paymentStatusEnum("status").notNull().default("pending"),
  notes: text("notes"),
  receivedBy: integer("received_by")
    .references(() => users.id)
    .notNull(),
  paidAt: timestamp("paid_at"),
  generatedBy: varchar("generated_by", { length: 20 }).default("manual"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
