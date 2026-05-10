import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { withErrorHandler } from "@/lib/api-handler";
import { getAllSettings, setSettings } from "@/lib/settings";
import { updateSettingsSchema, SETTING_KEYS } from "@/validators/settings";

export const GET = withErrorHandler(async () => {
  await requireRole(["admin"]);

  const all = await getAllSettings();

  return NextResponse.json({
    data: {
      mikrotikHost: all[SETTING_KEYS.MIKROTIK_HOST] || "",
      mikrotikPort: Number(all[SETTING_KEYS.MIKROTIK_PORT]) || 8728,
      mikrotikUser: all[SETTING_KEYS.MIKROTIK_USER] || "",
      mikrotikPassword: all[SETTING_KEYS.MIKROTIK_PASSWORD] || "",
      fonnteToken: all[SETTING_KEYS.FONNTE_TOKEN] || "",
      fonnteApiUrl:
        all[SETTING_KEYS.FONNTE_API_URL] || "https://api.fonnte.com/send",
    },
  });
});

export const PUT = withErrorHandler(async (req) => {
  await requireRole(["admin"]);

  const body = await req.json();
  const result = updateSettingsSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validation Error", details: result.error.format() },
      { status: 400 }
    );
  }

  const data = result.data;

  await setSettings({
    [SETTING_KEYS.MIKROTIK_HOST]: data.mikrotikHost,
    [SETTING_KEYS.MIKROTIK_PORT]: String(data.mikrotikPort),
    [SETTING_KEYS.MIKROTIK_USER]: data.mikrotikUser,
    [SETTING_KEYS.MIKROTIK_PASSWORD]: data.mikrotikPassword,
    [SETTING_KEYS.FONNTE_TOKEN]: data.fonnteToken,
    [SETTING_KEYS.FONNTE_API_URL]: data.fonnteApiUrl,
  });

  return NextResponse.json({ success: true });
});
