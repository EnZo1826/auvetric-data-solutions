// Unit tests for CRM security primitives (run: npm run crm:test:unit).
// TOTP is checked against the RFC 6238 reference vectors; passwords against scrypt behaviour.
import assert from 'node:assert/strict';
import { base32Decode, base32Encode, hotp, totp, verifyTotp, generateTotpSecret, otpauthUri } from '../../src/crm/server/totp.ts';
import { hashPassword, verifyPassword, passwordProblems } from '../../src/crm/server/password.ts';

// ── Base32 (RFC 4648) ──
assert.equal(base32Encode(Buffer.from('12345678901234567890')), 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
assert.deepEqual(base32Decode('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'), Buffer.from('12345678901234567890'));
assert.deepEqual(base32Decode('gezd gnbv-gy3t qojq gezd gnbv gy3t qojq'), Buffer.from('12345678901234567890'), 'lenient: lower-case, spaces, dashes');

// ── HOTP RFC 4226 Appendix D ──
const key = Buffer.from('12345678901234567890');
['755224', '287082', '359152', '969429', '338314'].forEach((code, counter) => assert.equal(hotp(key, counter), code, `HOTP counter ${counter}`));

// ── TOTP RFC 6238 Appendix B (SHA1, 8 digits; we also check 6-digit truncation) ──
const vectors = [[59, '94287082'], [1111111109, '07081804'], [1111111111, '14050471'], [1234567890, '89005924'], [2000000000, '69279037']];
for (const [t, code] of vectors) {
  assert.equal(totp(key, t * 1000, { digits: 8 }), code, `TOTP t=${t}`);
  assert.equal(totp(key, t * 1000), code.slice(-6), `TOTP 6-digit t=${t}`);
}

// ── Verification window, replay protection ──
const secret = generateTotpSecret();
assert.equal(base32Decode(secret).length, 20, '160-bit secret');
const now = 1_800_000_000_000;
const current = totp(base32Decode(secret), now);
assert.equal(verifyTotp(secret, current, { now }).ok, true);
assert.equal(verifyTotp(secret, totp(base32Decode(secret), now - 30_000), { now }).ok, true, 'previous step accepted (clock drift)');
assert.equal(verifyTotp(secret, totp(base32Decode(secret), now - 90_000), { now }).ok, false, '3 steps old rejected');
assert.equal(verifyTotp(secret, '12345', { now }).ok, false, 'wrong length rejected');
const step = verifyTotp(secret, current, { now }).step;
assert.equal(verifyTotp(secret, current, { now, lastUsedStep: step }).ok, false, 'same code cannot be reused');
assert.match(otpauthUri(secret, 'jakes9na@gmail.com'), /^otpauth:\/\/totp\/Auvetric%20CRM:jakes9na%40gmail\.com\?secret=[A-Z2-7]+&issuer=Auvetric%20CRM&algorithm=SHA1&digits=6&period=30$/);

// ── Passwords ──
const h = await hashPassword('correct horse battery staple 42');
assert.match(h, /^scrypt\$\d+\$\d+\$\d+\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
assert.equal(await verifyPassword('correct horse battery staple 42', h), true);
assert.equal(await verifyPassword('correct horse battery staple 43', h), false);
assert.notEqual(await hashPassword('same'), await hashPassword('same'), 'salted');
assert.equal(await verifyPassword('x', 'garbage'), false, 'malformed hash never throws or matches');
assert.ok(passwordProblems('short').length > 0, 'too short');
assert.ok(passwordProblems('aaaaaaaaaaaaaaaa').length > 0, 'single repeated character');
assert.ok(passwordProblems('jakes9na@gmail.com-pw', 'jakes9na@gmail.com').length > 0, 'contains email');
assert.deepEqual(passwordProblems('Namib-Dune-Pump-2026'), []);

// ── Secret sealing (AES-256-GCM) ──
process.env.CRM_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
const { seal, unseal, sha256 } = await import('../../src/crm/server/crypto.ts');
const sealed = seal('JBSWY3DPEHPK3PXP');
assert.match(sealed, /^v1\.[\w-]+\.[\w-]+\.[\w-]+$/);
assert.notEqual(seal('JBSWY3DPEHPK3PXP'), sealed, 'random IV per seal');
assert.equal(unseal(sealed), 'JBSWY3DPEHPK3PXP');
const parts = sealed.split('.'); parts[3] = parts[3].slice(0, -2) + (parts[3].endsWith('AA') ? 'BB' : 'AA');
assert.throws(() => unseal(parts.join('.')), 'tampered ciphertext rejected');
process.env.CRM_ENCRYPTION_KEY = Buffer.alloc(32, 8).toString('base64');
assert.throws(() => unseal(sealed), 'wrong key rejected');
process.env.CRM_ENCRYPTION_KEY = 'short';
assert.throws(() => seal('x'), /32 bytes/);
assert.equal(sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
// ── database URL rules (Supabase session pooler only, TLS for remote hosts) ──
const { sslFor, assertSupportedUrl } = await import('../../src/crm/server/db.ts');
assert.equal(sslFor('postgres://u:p@127.0.0.1:54329/db'), false);
assert.equal(sslFor('postgres://u:p@localhost/db'), false);
assert.equal(sslFor('postgresql://postgres.abc:p@aws-0-us-east-2.pooler.supabase.com:5432/postgres'), 'require');
assert.equal(sslFor('postgres://u:p@db.example/x?sslmode=disable'), false);
assert.doesNotThrow(() => assertSupportedUrl('postgresql://postgres.abc:p@aws-0-us-east-2.pooler.supabase.com:5432/postgres'));
assert.throws(() => assertSupportedUrl('postgresql://postgres.abc:p@aws-0-us-east-2.pooler.supabase.com:6543/postgres'), /session pooler/);
assert.throws(() => assertSupportedUrl('not a url'), /valid URL/);
console.log('CRM security units: base32, HOTP (RFC 4226), TOTP (RFC 6238), drift window, replay block, otpauth URI, scrypt hashing, password policy, database URL rules passed.');
