// Verifies the website → Web3Forms → email → n8n contract.
// The site embeds the whole submission as AUV1.<base64url JSON>.AUV; n8n decodes it with Node's Buffer.
// This test uses the same decode steps as automation/build_workflows.py (ENQ_PARSE_JS).
import assert from 'node:assert/strict';
import { buildRelayBody, encodePayload, RELAY_URL } from '../src/lib/relay.ts';

const enquiry = {
  intent: 'project', name: 'Ndapewa Nghipondoka', organisation: 'Ōshakati Fresh & Co — “Testing”', email: 'nd@example.com',
  phone: '+264 81 123 4567', interest: 'Data & Business Intelligence', description: 'Power BI for 3 stores. Ünïcode ✓ and "quotes" & <tags>.',
  budget: 'N$50 000 – N$150 000', timeline: 'Within 3 months',
};
const body = buildRelayBody(enquiry, { accessKey: 'test-key', intentLabel: 'Discuss a Project', submissionId: 'sub-123', now: new Date('2026-10-18T10:00:00Z') });

assert.equal(RELAY_URL, 'https://api.web3forms.com/submit');
assert.equal(body.access_key, 'test-key');
assert.equal(body.subject, '[Auvetric enquiry] Discuss a Project - Ndapewa Nghipondoka', 'n8n IMAP filter keys on this subject prefix');
assert.equal(body.replyto, 'nd@example.com');
assert.equal(body.botcheck, false, 'honeypot flag defaults to false for real users');
assert.equal(body.email, 'nd@example.com');

// decode exactly as n8n does: strip whitespace (email wrapping), regex, base64url -> utf8 JSON
const wrapped = `Payload: ${body.payload.slice(0, 40)}\n ${body.payload.slice(40)}`; // simulate line wrapping
const m = wrapped.replace(/\s+/g, '').match(/AUV1\.([A-Za-z0-9_-]+)\.AUV/);
assert.ok(m, 'payload marker found after line wrapping');
const decoded = JSON.parse(Buffer.from(m[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
assert.equal(decoded.submission_id, 'sub-123');
assert.equal(decoded.submitted_at, '2026-10-18T10:00:00.000Z');
for (const k of Object.keys(enquiry)) assert.equal(decoded[k], enquiry[k], `round-trip ${k}`);
assert.ok(!/[+/=]/.test(encodePayload({ a: '??>>' })), 'payload is base64url without padding');
console.log('Relay: subject contract, reply-to, honeypot, and unicode-safe AUV1 payload round-trip through n8n decoding passed.');
