import { describe, it, expect, vi, beforeEach } from "vitest";

const { dbExecute } = vi.hoisted(() => ({ dbExecute: vi.fn() }));
vi.mock("@/db", () => ({ db: { execute: dbExecute } }));

import {
  nextCustomerNumber,
  nextInvoiceNumber,
  nextTicketNumber,
} from "./ids";

beforeEach(() => {
  dbExecute.mockReset();
});

describe("nextCustomerNumber", () => {
  it("formats sequence value as YBY-NNNNN", async () => {
    dbExecute.mockResolvedValueOnce([{ nextval: 1000 }]);
    expect(await nextCustomerNumber()).toBe("YBY-01000");

    dbExecute.mockResolvedValueOnce([{ nextval: 42 }]);
    expect(await nextCustomerNumber()).toBe("YBY-00042");
  });

  it("produces 10_000 unique IDs over a monotonic sequence (no collision)", async () => {
    let counter = 0;
    dbExecute.mockImplementation(async () => [{ nextval: ++counter }]);

    const ids = new Set<string>();
    for (let i = 0; i < 10_000; i++) ids.add(await nextCustomerNumber());

    expect(ids.size).toBe(10_000);
    expect([...ids][0]).toMatch(/^YBY-\d{5}$/);
  });
});

describe("nextInvoiceNumber", () => {
  it("uses scoped counter and formats INV-YYYY-MM-NNNN", async () => {
    dbExecute.mockResolvedValueOnce([{ value: 1 }]);
    const inv = await nextInvoiceNumber(new Date("2026-03-15T12:00:00Z"));
    expect(inv).toBe("INV-2026-03-0001");

    const sqlArg = dbExecute.mock.calls[0][0];
    const flat = JSON.stringify(sqlArg);
    expect(flat).toContain("invoice:2026-03");
  });

  it("resets numbering across different months (different scope keys)", async () => {
    dbExecute.mockResolvedValueOnce([{ value: 1 }]);
    await nextInvoiceNumber(new Date("2026-03-15T12:00:00Z"));
    dbExecute.mockResolvedValueOnce([{ value: 1 }]);
    await nextInvoiceNumber(new Date("2026-04-01T00:00:00Z"));

    const scope1 = JSON.stringify(dbExecute.mock.calls[0][0]);
    const scope2 = JSON.stringify(dbExecute.mock.calls[1][0]);
    expect(scope1).toContain("invoice:2026-03");
    expect(scope2).toContain("invoice:2026-04");
  });
});

describe("nextTicketNumber", () => {
  it("formats TKT-YYYY-MM-NNNN with ticket scope", async () => {
    dbExecute.mockResolvedValueOnce([{ value: 7 }]);
    const tkt = await nextTicketNumber(new Date("2026-05-10T00:00:00Z"));
    expect(tkt).toBe("TKT-2026-05-0007");
    expect(JSON.stringify(dbExecute.mock.calls[0][0])).toContain(
      "ticket:2026-05"
    );
  });
});
