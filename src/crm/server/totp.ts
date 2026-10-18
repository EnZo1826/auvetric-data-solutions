/**
 * TOTP two-factor codes (RFC 6238 / RFC 4226), Node crypto only.
 * Compatible with Google Authenticator, Microsoft Authenticator, 1Password, Authy.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const ISSUER = "Auvetric CRM";

export function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = "";
  for (const byte of buf) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error("Invalid base32 character");
    value = (value << 5) | idx; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

export function hotp(key: Buffer, counter: number, digits = 6): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac("sha1", key).update(msg).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  const bin = ((mac[offset] & 0x7f) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3];
  return String(bin % 10 ** digits).padStart(digits, "0");
}

export function totp(key: Buffer, nowMs = Date.now(), opts: { digits?: number; period?: number } = {}): string {
  return hotp(key, Math.floor(nowMs / 1000 / (opts.period ?? 30)), opts.digits ?? 6);
}

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/**
 * Accepts the current 30 s step and one either side (clock drift).
 * Pass the last accepted step to block replay of an already-used code.
 */
export function verifyTotp(secret: string, code: string, opts: { now?: number; lastUsedStep?: number | null } = {}): { ok: boolean; step?: number } {
  const c = String(code ?? "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(c)) return { ok: false };
  let key: Buffer;
  try { key = base32Decode(secret); } catch { return { ok: false }; }
  const now = opts.now ?? Date.now();
  const current = Math.floor(now / 30_000);
  for (const step of [current, current - 1, current + 1]) {
    const expected = Buffer.from(hotp(key, step));
    if (timingSafeEqual(expected, Buffer.from(c)) && (opts.lastUsedStep == null || step > opts.lastUsedStep)) return { ok: true, step };
  }
  return { ok: false };
}

export function otpauthUri(secret: string, account: string): string {
  const label = encodeURIComponent(`${ISSUER}:${account}`).replace("%3A", ":");
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(ISSUER)}&algorithm=SHA1&digits=6&period=30`;
}
