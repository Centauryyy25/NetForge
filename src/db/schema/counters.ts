import { pgTable, varchar, bigint } from "drizzle-orm/pg-core";

export const counters = pgTable("counters", {
  scope: varchar("scope", { length: 50 }).primaryKey(),
  value: bigint("value", { mode: "number" }).notNull().default(0),
});
