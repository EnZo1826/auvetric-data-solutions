/**
 * Static-site enquiry relay (GitHub Pages has no backend).
 *
 * Browser → Web3Forms (https://web3forms.com) → email to the Auvetric mailbox → n8n workflow
 * "20 Website · process enquiries". The Web3Forms access key is public by design; it only lets a
 * form deliver to the mailbox registered with it.
 *
 * Contract with n8n (keep in sync with automation/build_workflows.py):
 *   - subject starts with "[Auvetric enquiry]" (the IMAP trigger filters on it)
 *   - the full submission is embedded as AUV1.<base64url(JSON)>.AUV so parsing does not depend
 *     on the relay's email layout or line wrapping.
 * Dependency-free so scripts/verify-relay.mjs can test it directly with Node.
 */
export const RELAY_URL = "https://api.web3forms.com/submit";

export interface RelayEnquiry {
  intent: string; name: string; organisation: string; email: string; phone: string;
  interest: string; description: string; budget: string; timeline: string;
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function encodePayload(data: unknown): string {
  return toBase64Url(new TextEncoder().encode(JSON.stringify(data)));
}

export function buildRelayBody(e: RelayEnquiry, opts: { accessKey: string; intentLabel: string; submissionId: string; now?: Date; botcheck?: boolean }) {
  const submitted_at = (opts.now ?? new Date()).toISOString();
  const payload = `AUV1.${encodePayload({ submission_id: opts.submissionId, submitted_at, ...e })}.AUV`;
  return {
    access_key: opts.accessKey,
    subject: `[Auvetric enquiry] ${opts.intentLabel} - ${e.name}`,
    from_name: "Auvetric website",
    replyto: e.email,
    botcheck: opts.botcheck ?? false,
    // human-readable copy for anyone reading the relay email directly
    name: e.name, email: e.email, organisation: e.organisation || "-", phone: e.phone || "-",
    intent: opts.intentLabel, interest: e.interest, budget: e.budget, timeline: e.timeline, message: e.description,
    payload,
  };
}
