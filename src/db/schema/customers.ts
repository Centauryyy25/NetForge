import { pgTable, serial, varchar, text, integer, timestamp, date, pgEnum } from "drizzle-orm/pg-core";
import { packages } from "./packages";

export const customerStatusEnum = pgEnum("customer_status", [
  "active",
  "inactive",
  "suspended",
  "terminated",
]);

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  customerId: varchar("customer_id", { length: 20 }).notNull().unique(), // e.g. YBY-2603-0001
  name: varchar("name", { length: 255 }).notNull(),
  address: text("address").notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  email: varchar("email", { length: 255 }),
  nik: varchar("nik", { length: 16 }),
  packageId: integer("package_id")
    .references(() => packages.id)
    .notNull(),
  registrationDate: date("registration_date").notNull(),
  activeUntil: date("active_until").notNull(),
  status: customerStatusEnum("status").notNull().default("active"),
  pppoeUsername: varchar("pppoe_username", { length: 100 }),
  pppoePasswordHash: varchar("pppoe_password_hash", { length: 255 }),
  onuSn: varchar("onu_sn", { length: 50 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
