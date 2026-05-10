import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";

const SENSITIVE_KEYS = new Set<string>([
  "mikrotik_password",
  "fonnte_token",
  "midtrans_server_key",
]);

const ALGO = "aes-256-gcm";
const KEY_LEN = 32;
const IV_LEN = 12;
const TAG_LEN = 16;
const HKDF_INFO = "settings-cipher-v1";
const HKDF_SALT = Buffer.alloc(0);

let cachedKey: Buffer | null = null;

function deriveKey(): Buffer {
  if (cachedKey) return cachedKey;
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "AUTH_SECRET is required to encrypt/decrypt settings values"
    );
  }
  cachedKey = Buffer.from(
    hkdfSync("sha256", Buffer.from(secret), HKDF_SALT, HKDF_INFO, KEY_LEN)
  );
  return cachedKey;
}

export function isSensitive(key: string): boolean {
  return SENSITIVE_KEYS.has(key);
}

export function encryptValue(plaintext: string): string {
  const key = deriveKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, ciphertext, tag]).toString("base64");
}

export function decryptValue(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  if (buf.length < IV_LEN + TAG_LEN) {
    throw new Error("settings-cipher: ciphertext too short");
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(buf.length - TAG_LEN);
  const ciphertext = buf.subarray(IV_LEN, buf.length - TAG_LEN);
  const key = deriveKey();
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

/** Reset cached key — exported for tests that mutate AUTH_SECRET. */
export function __resetKeyCache(): void {
  cachedKey = null;
}
