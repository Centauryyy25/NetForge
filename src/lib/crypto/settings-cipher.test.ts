import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  __resetKeyCache,
  decryptValue,
  encryptValue,
  isSensitive,
} from "./settings-cipher";

const ORIGINAL_SECRET = process.env.AUTH_SECRET;

beforeEach(() => {
  process.env.AUTH_SECRET =
    "test-secret-base64-32-bytes-long-padding-padding-pad=";
  __resetKeyCache();
});

afterEach(() => {
  process.env.AUTH_SECRET = ORIGINAL_SECRET;
  __resetKeyCache();
});

describe("isSensitive", () => {
  it("flags MikroTik password and Fonnte token", () => {
    expect(isSensitive("mikrotik_password")).toBe(true);
    expect(isSensitive("fonnte_token")).toBe(true);
    expect(isSensitive("midtrans_server_key")).toBe(true);
  });
  it("does not flag non-sensitive keys", () => {
    expect(isSensitive("mikrotik_host")).toBe(false);
    expect(isSensitive("mikrotik_user")).toBe(false);
    expect(isSensitive("fonnte_api_url")).toBe(false);
  });
});

describe("encrypt/decrypt round-trip", () => {
  it("decrypts back to plaintext", () => {
    const ct = encryptValue("super-secret-pw");
    expect(decryptValue(ct)).toBe("super-secret-pw");
  });

  it("produces ciphertext that does not contain the plaintext", () => {
    const ct = encryptValue("0123456789-PLAINTEXT");
    expect(ct).not.toContain("PLAINTEXT");
    expect(ct).toMatch(/^[A-Za-z0-9+/=]+$/);
  });

  it("produces a different ciphertext each call (random IV)", () => {
    const a = encryptValue("same");
    const b = encryptValue("same");
    expect(a).not.toBe(b);
    expect(decryptValue(a)).toBe("same");
    expect(decryptValue(b)).toBe("same");
  });
});

describe("AUTH_SECRET rotation", () => {
  it("decryption fails after AUTH_SECRET changes (expected behavior)", () => {
    const ct = encryptValue("pw");
    process.env.AUTH_SECRET = "different-secret-different-different-diff=";
    __resetKeyCache();
    expect(() => decryptValue(ct)).toThrow();
  });
});
