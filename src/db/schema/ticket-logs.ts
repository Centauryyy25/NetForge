import { pgTable, serial, integer, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { serviceRequests } from "./service-requests";
import { users } from "./users";

export const ticketLogs = pgTable("ticket_logs", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull().references(() => serviceRequests.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => users.id),
  action: varchar("action", { length: 50 }).notNull(), // e.g. "created", "status_change", "eskalasi", "tunda", "lanjut", "tutup", "gangguan-massal", "priority_change", "note"
  detail: text("detail"),           // human-readable description
  oldValue: varchar("old_value", { length: 100 }),
  newValue: varchar("new_value", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
