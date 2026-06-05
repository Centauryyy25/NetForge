import { db } from "@/db";
import { settings } from "@/db/schema/settings";
import { eq } from "drizzle-orm";
import { SETTING_KEYS } from "@/validators/settings";
import {
  decryptValue,
  encryptValue,
  isSensitive,
} from "@/lib/crypto/settings-cipher";

function readRow(row: { value: string; valueEncrypted: boolean }): string {
  return row.valueEncrypted ? decryptValue(row.value) : row.value;
}

/** Get a single setting value (decrypted if sensitive). Returns null if absent. */
export async function getSetting(key: string): Promise<string | null> {
  const row = await db.query.settings.findFirst({
    where: eq(settings.key, key),
  });
  if (!row) return null;
  return readRow(row);
}

/** Get all settings as a key-value map (decrypted). */
export async function getAllSettings(): Promise<Record<string, string>> {
  const rows = await db.query.settings.findMany();
  const map: Record<string, string> = {};
  for (const row of rows) {
    map[row.key] = readRow(row);
  }
  return map;
}

/** Upsert a setting; auto-encrypts if the key is sensitive. */
export async function setSetting(key: string, value: string): Promise<void> {
  const sensitive = isSensitive(key);
  const stored = sensitive ? encryptValue(value) : value;

  const existing = await db.query.settings.findFirst({
    where: eq(settings.key, key),
  });

  if (existing) {
    await db
      .update(settings)
      .set({
        value: stored,
        valueEncrypted: sensitive,
        updatedAt: new Date(),
      })
      .where(eq(settings.key, key));
  } else {
    await db.insert(settings).values({
      key,
      value: stored,
      valueEncrypted: sensitive,
    });
  }
}

/** Bulk upsert. */
export async function setSettings(
  entries: Record<string, string>
): Promise<void> {
  for (const [key, value] of Object.entries(entries)) {
    await setSetting(key, value);
  }
}

/** MikroTik config — sourced from DB only (no env fallback). */
export async function getMikroTikConfig(): Promise<{
  host: string;
  port: number;
  user: string;
  password: string;
}> {
  const all = await getAllSettings();
  return {
    host: all[SETTING_KEYS.MIKROTIK_HOST] ?? "",
    port: Number(all[SETTING_KEYS.MIKROTIK_PORT]) || 8728,
    user: all[SETTING_KEYS.MIKROTIK_USER] ?? "",
    password: all[SETTING_KEYS.MIKROTIK_PASSWORD] ?? "",
  };
}

/** Billing config — sourced from DB only. */
export async function getBillingConfig(): Promise<{
  dueDay: number;
  companyName: string;
  companyAddress: string;
  companyPhone: string;
}> {
  const all = await getAllSettings();
  return {
    dueDay: Number(all[SETTING_KEYS.BILLING_DUE_DAY]) || 20,
    companyName: all[SETTING_KEYS.BILLING_COMPANY_NAME] ?? "",
    companyAddress: all[SETTING_KEYS.BILLING_COMPANY_ADDRESS] ?? "",
    companyPhone: all[SETTING_KEYS.BILLING_COMPANY_PHONE] ?? "",
  };
}

/** Fonnte config — sourced from DB only (no env fallback). */
export async function getFonnteConfig(): Promise<{
  apiUrl: string;
  token: string;
}> {
  const all = await getAllSettings();
  return {
    apiUrl:
      all[SETTING_KEYS.FONNTE_API_URL] || "https://api.fonnte.com/send",
    token: all[SETTING_KEYS.FONNTE_TOKEN] ?? "",
  };
}
