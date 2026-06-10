import { describe, it, expect, vi, beforeEach } from "vitest";

const { mikrotikAdd, notificationAdd } = vi.hoisted(() => ({
  mikrotikAdd: vi.fn(
    async (_name: string, _data: unknown, _opts: unknown) => ({ id: "job-mt" })
  ),
  notificationAdd: vi.fn(
    async (_name: string, _data: unknown, _opts: unknown) => ({
      id: "job-noti",
    })
  ),
}));

vi.mock("bullmq", () => ({
  Queue: class MockQueue {
    private name: string;
    constructor(name: string) {
      this.name = name;
    }
    add(name: string, data: unknown, opts: unknown) {
      return this.name === "mikrotik-queue"
        ? mikrotikAdd(name, data, opts)
        : notificationAdd(name, data, opts);
    }
  },
}));
vi.mock("./connection", () => ({ redisConnection: {} }));

import {
  DEFAULT_JOB_OPTS,
  enqueueCreatePPPoE,
  enqueueSuspendPPPoE,
  enqueueActivatePPPoE,
  enqueueDeletePPPoE,
  enqueueSetQueue,
  enqueueDeleteQueue,
  enqueueWhatsAppBilling,
} from "./producer";

beforeEach(() => {
  mikrotikAdd.mockClear();
  notificationAdd.mockClear();
});

describe("DEFAULT_JOB_OPTS", () => {
  it("uses 3 attempts with exponential 2s backoff", () => {
    expect(DEFAULT_JOB_OPTS).toEqual({
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
    });
  });
});

describe("retry config is uniform across all enqueue helpers (FIX-009)", () => {
  it.each([
    ["enqueueCreatePPPoE", () =>
      enqueueCreatePPPoE({
        customerId: 1,
        username: "u",
        password: "p",
        profile: "pf",
      }),
    ],
    ["enqueueSuspendPPPoE", () => enqueueSuspendPPPoE({ username: "u" })],
    ["enqueueActivatePPPoE", () => enqueueActivatePPPoE({ username: "u" })],
    ["enqueueDeletePPPoE", () => enqueueDeletePPPoE({ username: "u" })],
    ["enqueueSetQueue", () =>
      enqueueSetQueue({ name: "u", target: "u", maxLimit: "10M/10M" }),
    ],
    ["enqueueDeleteQueue", () => enqueueDeleteQueue({ name: "u" })],
  ])("%s passes DEFAULT_JOB_OPTS to mikrotikQueue.add", async (_name, run) => {
    await run();
    expect(mikrotikAdd).toHaveBeenCalledOnce();
    const opts = mikrotikAdd.mock.calls[0][2];
    expect(opts).toEqual(DEFAULT_JOB_OPTS);
    mikrotikAdd.mockClear();
  });

  it("enqueueWhatsAppBilling passes DEFAULT_JOB_OPTS to notificationQueue.add", async () => {
    await enqueueWhatsAppBilling({
      customerPhone: "0812",
      customerName: "Budi",
      invoiceNumber: "INV-2026-05-0001",
      amount: 100000,
      periodMonth: "2026-05",
    });
    expect(notificationAdd).toHaveBeenCalledOnce();
    const opts = notificationAdd.mock.calls[0][2];
    expect(opts).toEqual(DEFAULT_JOB_OPTS);
  });
});
