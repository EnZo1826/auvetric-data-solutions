/** Password hashing with Node's built-in scrypt (memory-hard). Format: scrypt$N$r$p$salt$hash */
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, keylen: number, opts: { N: number; r: number; p: number; maxmem: number }) => Promise<Buffer>;
const N = 2 ** 15, R = 8, P = 1, KEYLEN = 32;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEYLEN, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [alg, n, r, p, salt, hash] = String(stored).split("$");
    if (alg !== "scrypt" || !salt || !hash) return false;
    const expected = Buffer.from(hash, "base64");
    const actual = await scrypt(password, Buffer.from(salt, "base64"), expected.length, { N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024 });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/** Returns human-readable problems; empty array = acceptable. */
export function passwordProblems(password: string, email = ""): string[] {
  const p = String(password ?? "");
  const out: string[] = [];
  if (p.length < 12) out.push("Use at least 12 characters.");
  if (p.length > 200) out.push("Use at most 200 characters.");
  if (new Set(p).size < 5) out.push("Use a wider mix of characters.");
  const local = email.split("@")[0]?.toLowerCase();
  if (local && local.length >= 4 && p.toLowerCase().includes(local)) out.push("Do not include your email address.");
  return out;
}
