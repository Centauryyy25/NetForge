import { describe, it, expect } from "vitest";
import { generatePPPoEPassword } from "./password";

describe("generatePPPoEPassword", () => {
  it("returns 12-character alphanumeric by default", () => {
    const p = generatePPPoEPassword();
    expect(p).toHaveLength(12);
    expect(p).toMatch(/^[A-Za-z0-9]{12}$/);
  });

  it("respects custom length", () => {
    expect(generatePPPoEPassword(20)).toHaveLength(20);
  });

  it("produces unique values across 1000 calls", () => {
    const set = new Set(
      Array.from({ length: 1000 }, () => generatePPPoEPassword())
    );
    expect(set.size).toBe(1000);
  });
});
