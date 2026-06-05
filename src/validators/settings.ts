import { z } from "zod/v4";

export const updateSettingsSchema = z.object({
  mikrotikHost: z.string().min(1, "Host wajib diisi"),
  mikrotikPort: z.coerce.number().int().min(1).max(65535).default(8728),
  mikrotikUser: z.string().min(1, "Username wajib diisi"),
  mikrotikPassword: z.string().default(""),
  fonnteToken: z.string().optional().default(""),
  fonnteApiUrl: z.string().optional().default("https://api.fonnte.com/send"),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

export const updateBillingSettingsSchema = z.object({
  billingDueDay: z.coerce.number().int().min(1).max(28).default(20),
  billingCompanyName: z.string().optional().default(""),
  billingCompanyAddress: z.string().optional().default(""),
  billingCompanyPhone: z.string().optional().default(""),
});

export type UpdateBillingSettingsInput = z.infer<typeof updateBillingSettingsSchema>;

export const SETTING_KEYS = {
  MIKROTIK_HOST: "mikrotik_host",
  MIKROTIK_PORT: "mikrotik_port",
  MIKROTIK_USER: "mikrotik_user",
  MIKROTIK_PASSWORD: "mikrotik_password",
  FONNTE_TOKEN: "fonnte_token",
  FONNTE_API_URL: "fonnte_api_url",
  BILLING_DUE_DAY: "billing_due_day",
  BILLING_COMPANY_NAME: "billing_company_name",
  BILLING_COMPANY_ADDRESS: "billing_company_address",
  BILLING_COMPANY_PHONE: "billing_company_phone",
} as const;
