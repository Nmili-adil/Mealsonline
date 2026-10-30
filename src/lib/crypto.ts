import "server-only";
import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

/** Generate a high-entropy URL-safe token. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** SHA-256 hex digest, used for opaque token storage. */
export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Constant-time string comparison for tokens and secrets. */
export function safeEqualStrings(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

/**
 * scrypt password hashing with a pepper derived from AUTH_SECRET.
 * Stored format: `scrypt$<saltHex>$<hashHex>`.
 */
export function hashPassword(password: string, secret: string): string {
  const salt = randomBytes(16).toString("hex");
  const pepper = sha256Hex(secret).slice(0, 32);
  const derived = scryptSync(`${password}:${pepper}`, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(
  password: string,
  stored: string,
  secret: string,
): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, expectedHex] = parts;
  const pepper = sha256Hex(secret).slice(0, 32);
  const derived = scryptSync(`${password}:${pepper}`, salt, 64);
  const expected = Buffer.from(expectedHex, "hex");
  return expected.length === derived.length && timingSafeEqual(derived, expected);
}

/** One-way hash of an IP address for audit logs (never store raw IPs). */
export function hashIp(ip: string, secret: string): string {
  return createHash("sha256")
    .update(`${ip}:${secret}`)
    .digest("hex")
    .slice(0, 32);
}
