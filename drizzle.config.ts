import { defineConfig } from "drizzle-kit";

// Load .env for local dev only; in production env vars come from the container.
// Use require (not top-level await) so drizzle-kit's cjs bundle can transform this.
if (process.env.NODE_ENV !== "production") {
  require("dotenv/config");
}

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
