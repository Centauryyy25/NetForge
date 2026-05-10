import { describe, it, expect, vi, beforeEach } from "vitest";

const { dbUpdate, updateSet, updateSetWhere } = vi.hoisted(() => {
  const where = vi.fn();
  const set = vi.fn(() => ({ where }));
  const update = vi.fn(() => ({ set }));
  return { dbUpdate: update, updateSet: set, updateSetWhere: where };
});

vi.mock("../db", () => ({
  db: { update: dbUpdate },
}));
vi.mock("../db/schema/customers", () => ({
  customers: { id: "customers.id" },
}));
vi.mock("../lib/queue/connection", () => ({
  redisConnection: {},
}));
vi.mock("bullmq", () => ({
  Worker: class {
    on() {
      return this;
    }
  },
}));
vi.mock("../lib/mikrotik/pppoe", () => ({
  createPPPoEUser: vi.fn(),
  suspendPPPoEUser: vi.fn(),
  activatePPPoEUser: vi.fn(),
  deletePPPoEUser: vi.fn(),
}));
vi.mock("../lib/mikrotik/queue", () => ({
  setSimpleQueue: vi.fn(),
  deleteSimpleQueue: vi.fn(),
}));

import {
  handleCreatePPPoESuccess,
  handleCreatePPPoEFailure,
} from "./mikrotik.worker";

beforeEach(() => {
  dbUpdate.mockClear();
  updateSet.mockClear();
  updateSetWhere.mockClear();
});

describe("handleCreatePPPoESuccess", () => {
  it("sets customer status to active", async () => {
    await handleCreatePPPoESuccess({
      name: "create-pppoe",
      data: { customerId: 42 },
      attemptsMade: 1,
      opts: { attempts: 3 },
    });
    expect(dbUpdate).toHaveBeenCalledOnce();
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: "active" })
    );
  });

  it("ignores non-CREATE_PPPOE jobs", async () => {
    await handleCreatePPPoESuccess({
      name: "delete-pppoe",
      data: { customerId: 42 },
      attemptsMade: 1,
      opts: { attempts: 3 },
    });
    expect(dbUpdate).not.toHaveBeenCalled();
  });
});

describe("handleCreatePPPoEFailure", () => {
  it("sets status to provisioning_failed only after final attempt", async () => {
    await handleCreatePPPoEFailure({
      name: "create-pppoe",
      data: { customerId: 7 },
      attemptsMade: 1,
      opts: { attempts: 3 },
    });
    expect(dbUpdate).not.toHaveBeenCalled();

    await handleCreatePPPoEFailure({
      name: "create-pppoe",
      data: { customerId: 7 },
      attemptsMade: 3,
      opts: { attempts: 3 },
    });
    expect(dbUpdate).toHaveBeenCalledOnce();
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: "provisioning_failed" })
    );
  });

  it("ignores null jobs", async () => {
    await handleCreatePPPoEFailure(null);
    expect(dbUpdate).not.toHaveBeenCalled();
  });

  it("ignores jobs without customerId", async () => {
    await handleCreatePPPoEFailure({
      name: "create-pppoe",
      data: {},
      attemptsMade: 3,
      opts: { attempts: 3 },
    });
    expect(dbUpdate).not.toHaveBeenCalled();
  });
});
