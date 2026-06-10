import { pgTable, serial, varchar, integer, decimal, timestamp } from "drizzle-orm/pg-core";
import { customers } from "./customers";

export const activityLogs = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id")
    .references(() => customers.id)
    .notNull(),
  action: varchar("action", { length: 50 }).notNull(), // login, logout, etc.
  duration: integer("duration"), // in seconds
  bytesIn: decimal("bytes_in", { precision: 15, scale: 0 }),
  bytesOut: decimal("bytes_out", { precision: 15, scale: 0 }),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});
