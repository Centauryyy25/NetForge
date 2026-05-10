import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  dbInsert,
  dbTransaction,
  findFirst,
  enqueueCreatePPPoE,
  authMock,
} = vi.hoisted(() => ({
  dbInsert: vi.fn(),
  dbTransaction: vi.fn(),
  findFirst: vi.fn(),
  enqueueCreatePPPoE: vi.fn(),
  authMock: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    insert: dbInsert,
    transaction: dbTransaction,
    query: { customers: { findFirst }, packages: { findFirst } },
  },
}));
vi.mock("@/db/schema/customers", () => ({ customers: {} }));
vi.mock("@/db/schema/packages", () => ({ packages: {} }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/lib/queue/producer", () => ({ enqueueCreatePPPoE }));
vi.mock("@/lib/ids", () => ({
  nextCustomerNumber: async () => "YBY-01000",
}));

import { POST, GET } from "./route";

const adminSession = {
  user: { id: "1", role: "admin", name: "admin", email: "a@b.c" },
};

const validBody = {
  name: "Budi Santoso",
  address: "Jl. Mawar No. 1",
  phone: "081234567890",
  packageId: 1,
  pppoeUsername: "budi01",
};

function makeReq(body: unknown) {
  return new Request("http://localhost/api/customers", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const emptyCtx = { params: Promise.resolve({}) };

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue(adminSession);
  (findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: 1,
    name: "Paket 10Mbps",
  });
});

describe("POST /api/customers — transactional provisioning", () => {
  it("scenario 1 — success path: insert + enqueue both run inside transaction", async () => {
    enqueueCreatePPPoE.mockResolvedValue({ id: "job-1" });
    dbTransaction.mockImplementation(async (cb) => {
      const tx = {
        insert: () => ({
          values: () => ({
            returning: async () => [{ id: 99, ...validBody }],
          }),
        }),
      };
      return cb(tx);
    });

    const res = await POST(makeReq(validBody), emptyCtx);
    expect(res.status).toBe(201);
    expect(dbTransaction).toHaveBeenCalledOnce();
    expect(enqueueCreatePPPoE).toHaveBeenCalledOnce();
    const payload = enqueueCreatePPPoE.mock.calls[0][0];
    expect(payload.customerId).toBe(99);
    expect(payload.username).toBe("budi01");
    expect(payload.password).toMatch(/^[A-Za-z0-9]{12}$/);
    expect(payload.password).not.toBe(validBody.phone);
  });

  it("scenario 2 — enqueue throws inside transaction → response 500, no commit", async () => {
    enqueueCreatePPPoE.mockRejectedValue(new Error("Redis down"));
    let txCommitted = false;
    dbTransaction.mockImplementation(async (cb) => {
      const tx = {
        insert: () => ({
          values: () => ({
            returning: async () => [{ id: 99, ...validBody }],
          }),
        }),
      };
      try {
        const r = await cb(tx);
        txCommitted = true;
        return r;
      } catch (e) {
        throw e;
      }
    });

    const res = await POST(makeReq(validBody), emptyCtx);
    expect(res.status).toBe(500);
    expect(txCommitted).toBe(false);
  });

  it("scenario 3 — no PPPoE username → no enqueue, plain insert", async () => {
    dbTransaction.mockImplementation(async (cb) => {
      const tx = {
        insert: () => ({
          values: () => ({
            returning: async () => [{ id: 100, name: validBody.name }],
          }),
        }),
      };
      return cb(tx);
    });
    const { pppoeUsername: _omit, ...bodyNoPppoe } = validBody;
    const res = await POST(makeReq(bodyNoPppoe), emptyCtx);
    expect(res.status).toBe(201);
    expect(enqueueCreatePPPoE).not.toHaveBeenCalled();
  });
});

describe("/api/customers — auth-guard (FIX-003)", () => {
  it("GET unauthenticated → 401", async () => {
    authMock.mockResolvedValue(null);
    const res = await GET(
      new Request("http://localhost/api/customers"),
      emptyCtx
    );
    expect(res.status).toBe(401);
  });

  it("POST as technician (non-admin/operator) → 403", async () => {
    authMock.mockResolvedValue({
      user: { id: "9", role: "technician", name: "tek", email: "t@b.c" },
    });
    const res = await POST(makeReq(validBody), emptyCtx);
    expect(res.status).toBe(403);
  });

  it("POST unauthenticated → 401", async () => {
    authMock.mockResolvedValue(null);
    const res = await POST(makeReq(validBody), emptyCtx);
    expect(res.status).toBe(401);
  });
});
