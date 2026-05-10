import { mikrotikQuery } from "./pool";

type RouterOSRecord = Record<string, string> & { ".id": string };

async function findQueue(name: string): Promise<RouterOSRecord | null> {
  const rows = await mikrotikQuery<RouterOSRecord[]>(
    "/queue/simple/print",
    [`?name=${name}`],
    0
  );
  return rows[0] ?? null;
}

export async function setSimpleQueue(
  name: string,
  target: string,
  maxLimit: string
): Promise<void> {
  const existing = await findQueue(name);

  if (existing) {
    await mikrotikQuery(
      "/queue/simple/set",
      [
        `=.id=${existing[".id"]}`,
        `=target=${target}`,
        `=max-limit=${maxLimit}`,
      ],
      0
    );
    return;
  }

  await mikrotikQuery(
    "/queue/simple/add",
    [`=name=${name}`, `=target=${target}`, `=max-limit=${maxLimit}`],
    0
  );
}

/** Idempotent: deleting a queue that does not exist is a no-op. */
export async function deleteSimpleQueue(name: string): Promise<void> {
  const existing = await findQueue(name);
  if (!existing) return;

  await mikrotikQuery(
    "/queue/simple/remove",
    [`=.id=${existing[".id"]}`],
    0
  );
}
