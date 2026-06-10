import { pgTable, serial, varchar, integer, decimal, timestamp, boolean } from "drizzle-orm/pg-core";

export const packages = pgTable("packages", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  speed: integer("speed").notNull(), // in Mbps
  price: decimal("price", { precision: 12, scale: 2 }).notNull(),
  queueTarget: varchar("queue_target", { length: 50 }), // MikroTik format: upload/download e.g. "20M/20M"
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
