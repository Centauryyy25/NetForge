import "dotenv/config";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema/settings";
import { encryptValue, isSensitive } from "@/lib/crypto/settings-cipher";

async function main(): Promise<void> {
  const rows = await db.query.settings.findMany();
  let changed = 0;

  for (const row of rows) {
    if (!isSensitive(row.key)) continue;
    if (row.valueEncrypted) continue;
    if (row.value === "") continue;

    const ciphertext = encryptValue(row.value);
    await db
      .update(settings)
      .set({
        value: ciphertext,
        valueEncrypted: true,
        updatedAt: new Date(),
      })
      .where(and(eq(settings.key, row.key), eq(settings.valueEncrypted, false)));
    changed++;
    console.log(`encrypted: ${row.key}`);
  }

  console.log(`done. ${changed} row(s) encrypted.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
