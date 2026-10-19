/**
 * Outgoing email over SMTP (Zoho Mail for auvetric.com). Settings live in `settings` under key 'mail';
 * the password is sealed with CRM_ENCRYPTION_KEY and never returned to the browser.
 */
import nodemailer from "nodemailer";
import { z } from "zod";
import { db } from "./db";
import { seal, unseal } from "./crypto";
import { HttpError } from "./http";

export const MAIL_PRESETS = [
  { key: "zoho-com", label: "Zoho Mail · US (own domain)", host: "smtppro.zoho.com" },
  { key: "zoho-eu", label: "Zoho Mail · EU (own domain)", host: "smtppro.zoho.eu" },
  { key: "zoho-personal", label: "Zoho Mail · personal @zoho.com", host: "smtp.zoho.com" },
] as const;

export type TemplateKind = "invoice" | "quote" | "statement";
export const TEMPLATE_KINDS: TemplateKind[] = ["invoice", "quote", "statement"];
export const DEFAULT_TEMPLATES: Record<TemplateKind, { subject: string; body: string }> = {
  invoice: {
    subject: "Invoice {{number}} from {{company}}",
    body: "Dear {{contact}},\n\nPlease find attached invoice {{number}} for {{total}}, due on {{due_date}}.\n\nPayment details and the reference to use are on the invoice. Let us know if you have any questions.\n\nKind regards,\n{{sender}}\n{{company}}",
  },
  quote: {
    subject: "Quotation {{number}} from {{company}}",
    body: "Dear {{contact}},\n\nThank you for the opportunity. Please find attached quotation {{number}} for {{total}}, valid until {{due_date}}.\n\nTo accept, simply reply to this email. We are happy to walk you through it.\n\nKind regards,\n{{sender}}\n{{company}}",
  },
  statement: {
    subject: "Statement of account from {{company}}",
    body: "Dear {{contact}},\n\nPlease find attached your statement of account for {{period}}. The balance due is {{balance}}.\n\nIf you have already paid, thank you, and please ignore this reminder.\n\nKind regards,\n{{sender}}\n{{company}}",
  },
};

const addr = z.string().trim().max(254).refine((v) => v === "" || z.email().safeParse(v).success, "Enter a valid email address.");
export const MailSettingsBody = z.object({
  host: z.string().trim().min(3, "Enter the SMTP server.").max(200).regex(/^[a-z0-9.-]+$/i, "The SMTP server is a host name like smtppro.zoho.com."),
  port: z.coerce.number().int().min(1).max(65535),
  security: z.enum(["ssl", "starttls", "none"]),
  user: z.string().trim().min(3, "Enter the mailbox login.").max(254),
  password: z.string().max(500).optional(), // blank/absent = keep the saved one
  fromName: z.string().trim().max(120).default(""),
  fromEmail: z.string().trim().max(254).pipe(z.email("Enter the sender address.")),
  replyTo: addr.default(""),
  bccSender: z.boolean().default(true),
  templates: z.object(Object.fromEntries(TEMPLATE_KINDS.map((k) => [k, z.object({ subject: z.string().trim().min(1).max(300), body: z.string().min(1).max(10_000) })])) as Record<TemplateKind, z.ZodObject<{ subject: z.ZodString; body: z.ZodString }>>).partial().default({}),
}).superRefine((b, ctx) => {
  if (b.security === "none" && !["localhost", "127.0.0.1"].includes(b.host)) ctx.addIssue({ code: "custom", message: "Unencrypted SMTP is only allowed to a local test server. Use SSL or STARTTLS.", path: ["security"] });
});
export type MailSettingsInput = z.infer<typeof MailSettingsBody>;

type Stored = Omit<MailSettingsInput, "password"> & { passwordSealed: string };

async function loadStored(): Promise<Stored | null> {
  const [r] = await db()`select value from settings where key = 'mail'`;
  return (r?.value as Stored) ?? null;
}

/** Safe view for the settings screen. */
export async function mailSettingsView() {
  const s = await loadStored();
  const templates = Object.fromEntries(TEMPLATE_KINDS.map((k) => [k, s?.templates?.[k] ?? DEFAULT_TEMPLATES[k]]));
  if (!s) return { configured: false, host: MAIL_PRESETS[0].host, port: 465, security: "ssl", user: "", hasPassword: false, fromName: "Auvetric Data Solutions", fromEmail: "", replyTo: "", bccSender: true, templates, presets: MAIL_PRESETS };
  const { passwordSealed, ...rest } = s;
  return { configured: true, ...rest, hasPassword: !!passwordSealed, templates, presets: MAIL_PRESETS };
}

export async function saveMailSettings(b: MailSettingsInput) {
  const prev = await loadStored();
  let passwordSealed = prev?.passwordSealed ?? "";
  if (b.password) passwordSealed = seal(b.password);
  if (!passwordSealed) throw new HttpError(400, "Enter the mailbox password (or Zoho app-specific password).");
  // Templates equal to the defaults are not stored, so later default improvements still apply.
  const templates = Object.fromEntries(Object.entries(b.templates ?? {}).filter(([k, v]) => v && (v.subject !== DEFAULT_TEMPLATES[k as TemplateKind].subject || v.body !== DEFAULT_TEMPLATES[k as TemplateKind].body)));
  const { password: _omit, ...rest } = b;
  void _omit;
  const value: Stored = { ...rest, templates, passwordSealed };
  await db()`insert into settings (key, value) values ('mail', ${db().json(value as never)})
    on conflict (key) do update set value = excluded.value, updated_at = now()`;
}

export async function template(kind: TemplateKind) {
  const s = await loadStored();
  return s?.templates?.[kind] ?? DEFAULT_TEMPLATES[kind];
}

export function fill(tpl: string, vars: Record<string, string>) {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k: string) => (k in vars ? vars[k] : m));
}

export type OutMail = { to: string[]; cc: string[]; subject: string; text: string; attachments: { filename: string; content: Uint8Array; contentType: string }[] };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
function html(text: string) {
  const paras = esc(text).split(/\n{2,}/).map((p) => `<p style="margin:0 0 12px">${p.replace(/\n/g, "<br>")}</p>`).join("");
  return `<!doctype html><html><body style="font:14px/1.5 Arial,Helvetica,sans-serif;color:#0a1830">${paras}</body></html>`;
}

/** Sends one message. Throws HttpError(502) with the server's reason on failure (the caller logs it). */
export async function sendMail(m: OutMail): Promise<{ messageId: string; accepted: string[] }> {
  const s = await loadStored();
  if (!s?.passwordSealed) throw new HttpError(409, "Email is not set up yet. An admin can add the mail server under Settings → Email.");
  const transport = nodemailer.createTransport({
    host: s.host, port: s.port,
    secure: s.security === "ssl",
    requireTLS: s.security === "starttls",
    ignoreTLS: s.security === "none",
    auth: { user: s.user, pass: unseal(s.passwordSealed) },
    connectionTimeout: 8_000, greetingTimeout: 8_000, socketTimeout: 15_000,
    tls: { minVersion: "TLSv1.2" },
  });
  try {
    const info = await transport.sendMail({
      from: { name: s.fromName || s.fromEmail, address: s.fromEmail },
      to: m.to, cc: m.cc.length ? m.cc : undefined,
      bcc: s.bccSender ? s.fromEmail : undefined,
      replyTo: s.replyTo || undefined,
      subject: m.subject, text: m.text, html: html(m.text),
      attachments: m.attachments.map((a) => ({ filename: a.filename, content: Buffer.from(a.content), contentType: a.contentType })),
    });
    return { messageId: String(info.messageId ?? ""), accepted: (info.accepted ?? []).map(String) };
  } catch (e) {
    throw new HttpError(502, explain(e));
  } finally {
    transport.close();
  }
}

/** Turns SMTP errors into something a partner can act on. */
function explain(e: unknown): string {
  const err = e as { code?: string; responseCode?: number; response?: string; message?: string };
  const resp = (err.response || err.message || "").slice(0, 300);
  if (err.code === "EAUTH" || err.responseCode === 535) return `The mail server rejected the login. Check the mailbox address and password; with two-factor sign-in on Zoho, use an app-specific password. (${resp})`;
  if (err.code === "ETIMEDOUT" || err.code === "ECONNECTION" || err.code === "ESOCKET" || err.code === "ECONNREFUSED") return `Could not connect to the mail server. Check the server name, port and security setting. (${resp})`;
  if (err.responseCode === 553 || err.responseCode === 550) return `The mail server refused the sender or a recipient. The sender address must be your Zoho mailbox or one of its aliases. (${resp})`;
  return `The mail server returned an error: ${resp}`;
}

export const emailList = z.array(z.string().trim().pipe(z.email("One of the addresses is not a valid email."))).max(10, "At most 10 recipients.");

export async function logEmail(e: { kind: "invoice" | "quote" | "statement" | "test"; documentId?: string | null; clientId?: string | null; to: string[]; cc: string[]; subject: string; attachments: string[];
  status: "sent" | "failed"; error?: string; messageId?: string; userId: string }) {
  await db()`insert into emails (kind, document_id, client_id, to_addrs, cc_addrs, subject, attachments, status, error, message_id, sent_by)
    values (${e.kind}, ${e.documentId ?? null}, ${e.clientId ?? null}, ${e.to}, ${e.cc}, ${e.subject}, ${e.attachments}, ${e.status}, ${(e.error ?? "").slice(0, 1000)}, ${e.messageId ?? ""}, ${e.userId})`;
}
