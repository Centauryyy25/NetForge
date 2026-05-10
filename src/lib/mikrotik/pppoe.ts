import { mikrotikQuery } from "./pool";

type RouterOSRecord = Record<string, string> & { ".id": string };

async function findSecret(name: string): Promise<RouterOSRecord | null> {
  const rows = await mikrotikQuery<RouterOSRecord[]>(
    "/ppp/secret/print",
    [`?name=${name}`],
    0
  );
  return rows[0] ?? null;
}

async function findActiveSession(name: string): Promise<RouterOSRecord | null> {
  const rows = await mikrotikQuery<RouterOSRecord[]>(
    "/ppp/active/print",
    [`?name=${name}`],
    0
  );
  return rows[0] ?? null;
}

/**
 * Idempotent: if a secret with this name already exists, update it
 * (password/profile/disabled) instead of throwing "already exists".
 */
export async function createPPPoEUser(
  name: string,
  password: string,
  profile: string
): Promise<void> {
  const existing = await findSecret(name);

  if (existing) {
    await mikrotikQuery(
      "/ppp/secret/set",
      [
        `=.id=${existing[".id"]}`,
        `=password=${password}`,
        `=profile=${profile}`,
        `=disabled=no`,
      ],
      0
    );
    return;
  }

  await mikrotikQuery(
    "/ppp/secret/add",
    [
      `=name=${name}`,
      `=password=${password}`,
      `=service=pppoe`,
      `=profile=${profile}`,
    ],
    0
  );
}

export async function suspendPPPoEUser(name: string): Promise<void> {
  const existing = await findSecret(name);
  if (!existing) throw new Error(`PPPoE secret not found: ${name}`);

  await mikrotikQuery(
    "/ppp/secret/set",
    [`=.id=${existing[".id"]}`, `=disabled=true`],
    0
  );

  const active = await findActiveSession(name);
  if (active) {
    await mikrotikQuery(
      "/ppp/active/remove",
      [`=.id=${active[".id"]}`],
      0
    );
  }
}

export async function activatePPPoEUser(name: string): Promise<void> {
  const existing = await findSecret(name);
  if (!existing) throw new Error(`PPPoE secret not found: ${name}`);

  await mikrotikQuery(
    "/ppp/secret/set",
    [`=.id=${existing[".id"]}`, `=disabled=false`],
    0
  );
}

/**
 * Idempotent: deleting a secret that does not exist is a no-op
 * (covers the case where it was removed manually on the router).
 */
export async function deletePPPoEUser(name: string): Promise<void> {
  const existing = await findSecret(name);
  if (!existing) return;

  await mikrotikQuery(
    "/ppp/secret/remove",
    [`=.id=${existing[".id"]}`],
    0
  );

  const active = await findActiveSession(name);
  if (active) {
    await mikrotikQuery(
      "/ppp/active/remove",
      [`=.id=${active[".id"]}`],
      0
    );
  }
}
