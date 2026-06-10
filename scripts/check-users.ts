import "dotenv/config";
import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;
console.log("DATABASE_URL:", DATABASE_URL ? DATABASE_URL.replace(/:[^:@]+@/, ":***@") : "NOT SET");

const conn = postgres(DATABASE_URL!, { max: 1, connect_timeout: 5 });

async function check() {
  try {
    const result = await conn`SELECT 1 as ok`;
    console.log("DB connection: OK");

    const tables = await conn`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    `;
    console.log("Tables:", tables.map((t: any) => t.tablename).join(", ") || "(none)");

    if (tables.some((t: any) => t.tablename === "users")) {
      const users = await conn`SELECT id, email, role FROM users`;
      console.log(`\nUsers: ${users.length}`);
      users.forEach((u: any) => console.log(`  - ${u.email} | role: ${u.role}`));
    } else {
      console.log("\n⚠️  'users' table does not exist!");
    }
  } catch (e: any) {
    console.error("DB Error:", e.code, e.message);
  }
  await conn.end();
}
check();
