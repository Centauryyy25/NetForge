import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { hashSync } from "bcryptjs";
import { users } from "./schema/users";
import { packages } from "./schema/packages";
import { customers } from "./schema/customers";
import { payments } from "./schema/payments";
import * as schema from "./schema";

// ══════════════════════════════════════════
// Seed Script — Development Data
// Run: pnpm tsx src/db/seed.ts
// ══════════════════════════════════════════

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is not set");
  process.exit(1);
}

const conn = postgres(DATABASE_URL, { max: 1 });
const db = drizzle(conn, { schema });

async function seed() {
  console.log("🌱 Seeding database...\n");

  // ── 1. Users ──
  console.log("👤 Creating users...");
  const [admin] = await db
    .insert(users)
    .values([
      {
        name: "Administrator",
        email: "admin@ybynet.id",
        password: hashSync("admin123", 10),
        role: "admin",
      },
      {
        name: "Operator YBY",
        email: "operator@ybynet.id",
        password: hashSync("operator123", 10),
        role: "operator",
      },
      {
        name: "Teknisi YBY",
        email: "teknisi@ybynet.id",
        password: hashSync("teknisi123", 10),
        role: "technician",
      },
    ])
    .returning();
  console.log("  ✅ 3 users created (admin / operator / technician)");

  // ── 2. Packages ──
  console.log("📦 Creating packages...");
  const insertedPackages = await db
    .insert(packages)
    .values([
      {
        name: "Starter 10 Mbps",
        speed: 10,
        price: "100000",
        queueTarget: "10M/10M",
        isActive: true,
      },
      {
        name: "Basic 20 Mbps",
        speed: 20,
        price: "150000",
        queueTarget: "20M/20M",
        isActive: true,
      },
      {
        name: "Standard 30 Mbps",
        speed: 30,
        price: "200000",
        queueTarget: "30M/30M",
        isActive: true,
      },
      {
        name: "Premium 50 Mbps",
        speed: 50,
        price: "300000",
        queueTarget: "50M/50M",
        isActive: true,
      },
      {
        name: "Ultimate 100 Mbps",
        speed: 100,
        price: "500000",
        queueTarget: "100M/100M",
        isActive: true,
      },
    ])
    .returning();
  console.log(`  ✅ ${insertedPackages.length} packages created`);

  // ── 3. Sample Customers ──
  console.log("👥 Creating sample customers...");
  const sampleCustomers = await db
    .insert(customers)
    .values([
      {
        customerId: "YBY-2601-0001",
        name: "Ahmad Suryadi",
        address: "Jl. Mutiara IV No. 10, Curug, Gn. Sindur",
        phone: "081234567001",
        email: "ahmad@email.com",
        packageId: insertedPackages[1].id,
        registrationDate: "2026-01-15",
        activeUntil: "2026-05-15",
        status: "active",
        pppoeUsername: "yby-ahmad",
      },
      {
        customerId: "YBY-2601-0002",
        name: "Siti Nurhaliza",
        address: "Jl. Mutiara IV No. 15, Curug, Gn. Sindur",
        phone: "081234567002",
        packageId: insertedPackages[2].id,
        registrationDate: "2026-01-20",
        activeUntil: "2026-05-20",
        status: "active",
        pppoeUsername: "yby-siti",
      },
      {
        customerId: "YBY-2602-0003",
        name: "Budi Santoso",
        address: "Jl. Melati No. 5, Curug, Gn. Sindur",
        phone: "081234567003",
        packageId: insertedPackages[0].id,
        registrationDate: "2026-02-01",
        activeUntil: "2026-04-01",
        status: "suspended",
        pppoeUsername: "yby-budi",
        notes: "Belum bayar 2 bulan",
      },
      {
        customerId: "YBY-2602-0004",
        name: "Dewi Lestari",
        address: "Jl. Anggrek No. 8, Curug, Gn. Sindur",
        phone: "081234567004",
        email: "dewi@email.com",
        packageId: insertedPackages[3].id,
        registrationDate: "2026-02-10",
        activeUntil: "2026-05-10",
        status: "active",
        pppoeUsername: "yby-dewi",
      },
      {
        customerId: "YBY-2603-0005",
        name: "Eko Prasetyo",
        address: "Jl. Mawar No. 3, Curug, Gn. Sindur",
        phone: "081234567005",
        packageId: insertedPackages[1].id,
        registrationDate: "2026-03-01",
        activeUntil: "2026-04-30",
        status: "active",
        pppoeUsername: "yby-eko",
      },
    ])
    .returning();
  console.log(`  ✅ ${sampleCustomers.length} customers created`);

  // ── 4. Sample Payments ──
  console.log("💳 Creating sample payments...");
  const samplePayments = await db
    .insert(payments)
    .values([
      {
        invoiceNumber: "INV-2603-00001",
        customerId: sampleCustomers[0].id,
        amount: "150000",
        paymentDate: "2026-03-15",
        paymentMethod: "transfer",
        periodMonth: "2026-03",
        status: "paid",
        receivedBy: admin.id,
      },
      {
        invoiceNumber: "INV-2603-00002",
        customerId: sampleCustomers[1].id,
        amount: "200000",
        paymentDate: "2026-03-20",
        paymentMethod: "cash",
        periodMonth: "2026-03",
        status: "paid",
        receivedBy: admin.id,
      },
      {
        invoiceNumber: "INV-2604-00003",
        customerId: sampleCustomers[0].id,
        amount: "150000",
        paymentDate: "2026-04-01",
        paymentMethod: "qris",
        periodMonth: "2026-04",
        status: "pending",
        receivedBy: admin.id,
      },
      {
        invoiceNumber: "INV-2604-00004",
        customerId: sampleCustomers[2].id,
        amount: "100000",
        paymentDate: "2026-04-01",
        paymentMethod: "cash",
        periodMonth: "2026-03",
        status: "overdue",
        notes: "Belum bayar sejak Maret",
        receivedBy: admin.id,
      },
    ])
    .returning();
  console.log(`  ✅ ${samplePayments.length} payments created`);

  console.log("\n═══════════════════════════════════════");
  console.log("🎉 Seed completed successfully!");
  console.log("═══════════════════════════════════════");
  console.log("\n📋 Default Login Credentials:");
  console.log("┌────────────┬──────────────────────┬──────────────┐");
  console.log("│ Role       │ Email                │ Password     │");
  console.log("├────────────┼──────────────────────┼──────────────┤");
  console.log("│ Admin      │ admin@ybynet.id      │ admin123     │");
  console.log("│ Operator   │ operator@ybynet.id   │ operator123  │");
  console.log("│ Technician │ teknisi@ybynet.id    │ teknisi123   │");
  console.log("└────────────┴──────────────────────┴──────────────┘");
  console.log("\n⚠️  Ganti password default setelah login pertama!\n");

  await conn.end();
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
