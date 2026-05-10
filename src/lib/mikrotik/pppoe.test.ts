import { describe, it, expect, vi, beforeEach } from "vitest";

const { mikrotikQuery } = vi.hoisted(() => ({ mikrotikQuery: vi.fn() }));
vi.mock("./pool", () => ({ mikrotikQuery }));

import {
  createPPPoEUser,
  suspendPPPoEUser,
  deletePPPoEUser,
} from "./pppoe";

beforeEach(() => mikrotikQuery.mockReset());

function calls() {
  return mikrotikQuery.mock.calls.map((c) => c[0]);
}

describe("createPPPoEUser — idempotency (FIX-006)", () => {
  it("first call adds the secret when none exists", async () => {
    mikrotikQuery
      .mockResolvedValueOnce([]) // print → empty
      .mockResolvedValueOnce([]); // add

    await createPPPoEUser("alice", "pw1", "10M");

    expect(calls()).toEqual(["/ppp/secret/print", "/ppp/secret/add"]);
  });

  it("3 sequential calls for the same name → 3x success, no 'already exists' error", async () => {
    // 1st call: print empty → add
    mikrotikQuery
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    await createPPPoEUser("alice", "pw1", "10M");

    // 2nd call: print returns existing → set (not add)
    mikrotikQuery
      .mockResolvedValueOnce([{ ".id": "*1", name: "alice" }])
      .mockResolvedValueOnce([]);
    await createPPPoEUser("alice", "pw2", "10M");

    // 3rd call: same — set
    mikrotikQuery
      .mockResolvedValueOnce([{ ".id": "*1", name: "alice" }])
      .mockResolvedValueOnce([]);
    await createPPPoEUser("alice", "pw3", "20M");

    expect(calls()).toEqual([
      "/ppp/secret/print",
      "/ppp/secret/add",
      "/ppp/secret/print",
      "/ppp/secret/set",
      "/ppp/secret/print",
      "/ppp/secret/set",
    ]);
  });

  it("update path forwards new password and profile", async () => {
    mikrotikQuery
      .mockResolvedValueOnce([{ ".id": "*7", name: "bob" }])
      .mockResolvedValueOnce([]);

    await createPPPoEUser("bob", "newpw", "20M");

    const setArgs = mikrotikQuery.mock.calls[1][1] as string[];
    expect(setArgs).toContain("=.id=*7");
    expect(setArgs).toContain("=password=newpw");
    expect(setArgs).toContain("=profile=20M");
    expect(setArgs).toContain("=disabled=no");
  });
});

describe("deletePPPoEUser — idempotency", () => {
  it("does nothing when secret does not exist (graceful)", async () => {
    mikrotikQuery.mockResolvedValueOnce([]); // print → empty

    await expect(deletePPPoEUser("ghost")).resolves.toBeUndefined();
    expect(calls()).toEqual(["/ppp/secret/print"]);
  });

  it("removes secret + active session when both exist", async () => {
    mikrotikQuery
      .mockResolvedValueOnce([{ ".id": "*1", name: "alice" }]) // print secret
      .mockResolvedValueOnce([]) // remove secret
      .mockResolvedValueOnce([{ ".id": "*9", name: "alice" }]) // print active
      .mockResolvedValueOnce([]); // remove active

    await deletePPPoEUser("alice");

    expect(calls()).toEqual([
      "/ppp/secret/print",
      "/ppp/secret/remove",
      "/ppp/active/print",
      "/ppp/active/remove",
    ]);
  });
});

describe("suspendPPPoEUser", () => {
  it("throws when secret not found (suspending unknown user is an error)", async () => {
    mikrotikQuery.mockResolvedValueOnce([]); // print → empty
    await expect(suspendPPPoEUser("ghost")).rejects.toThrow(
      /not found: ghost/
    );
  });
});
