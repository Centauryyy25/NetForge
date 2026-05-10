import { pgTable, serial, varchar, timestamp, boolean } from "drizzle-orm/pg-core";

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: varchar("value", { length: 1000 }).notNull().default(""),
  valueEncrypted: boolean("value_encrypted").notNull().default(false),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
