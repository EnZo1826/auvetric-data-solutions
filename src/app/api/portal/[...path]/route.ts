/** Client portal API (Phase 5). Public sign-in endpoints plus session-protected document actions. */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { assertSameOrigin, clientMeta, handle, HttpError, json, readJson } from "@/crm/server/http";
import { decideQuote, AcceptBody, DeclineBody, destroyPortalSession, paymentNotice, portalBase, portalCookieOptions, portalDocument, PORTAL_COOKIE, ProofFields, readPortalSession, requestLink, verifyLink, assertClient, emailZ } from "@/crm/server/portal";
import { documentPdf, statementPdf } from "@/crm/server/pdf";
import { clientStatement } from "@/crm/server/finance";
import { fileResponse } from "@/crm/server/files";
import { MAX_UPLOAD } from "@/crm/server/attachments";
import type { CompanyData, Currency, DocData } from "@/crm/shared/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fileSafe = (s: string) => s.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
const iso = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

async function session(req: NextRequest) {
  const s = await readPortalSession(req.cookies.get(PORTAL_COOKIE)?.value);
  if (!s) throw new HttpError(401, "Your portal session has ended. Please sign in again.");
  return s;
}

const run = handle(async (req: NextRequest) => {
  const path = "/" + req.nextUrl.pathname.replace(/^\/api\/portal\/?/, "").replace(/\/+$/, "");
  const meta = clientMeta(req);
  const m = req.method;
  if (m !== "GET") assertSameOrigin(req);
  let p: RegExpMatchArray | null;

  if (m === "POST" && path === "/login") {
    const b = await readJson(req, z.object({ email: emailZ }));
    await requestLink(b.email, meta, portalBase(req));
    return json({ ok: true });
  }
  if (m === "POST" && path === "/verify") {
    const b = await readJson(req, z.object({ token: z.string().max(200) }));
    const s = await verifyLink(b.token, meta);
    const res = json({ ok: true });
    res.cookies.set(PORTAL_COOKIE, s.token, portalCookieOptions(s.maxAge));
    return res;
  }
  if (m === "POST" && path === "/logout") {
    const s = await readPortalSession(req.cookies.get(PORTAL_COOKIE)?.value);
    if (s) await destroyPortalSession(s.id);
    const res = json({ ok: true });
    res.cookies.set(PORTAL_COOKIE, "", { ...portalCookieOptions(0), maxAge: 0 });
    return res;
  }

  const s = await session(req);
  if (m === "GET" && (p = path.match(/^\/documents\/(\d{1,18})\/pdf$/))) {
    const d = await portalDocument(s, p[1]);
    const bytes = await documentPdf({ type: d.type, number: d.number, date: String(d.date), due_date: String(d.due_date), currency: d.currency as Currency, data: d.data as DocData, status: d.status, amount_paid: Number(d.amount_paid ?? 0) },
      { name: d.company_name, data: d.company_data as CompanyData });
    return fileResponse(bytes, `${fileSafe(`${d.number} ${(d.data as DocData).client.name}`)}.pdf`, "application/pdf", req.nextUrl.searchParams.get("inline") === "1") as NextResponse;
  }
  if (m === "GET" && path === "/statement/pdf") {
    const cid = req.nextUrl.searchParams.get("client_id") ?? s.clients[0].id;
    assertClient(s, cid);
    const st = await clientStatement(cid, iso(req.nextUrl.searchParams.get("from")), iso(req.nextUrl.searchParams.get("to")));
    const bytes = await statementPdf({ client: st.client as never, company: st.company as never, from: st.from, to: st.to, sections: st.sections });
    return fileResponse(bytes, `${fileSafe(`Statement ${st.client.name} ${st.to}`)}.pdf`, "application/pdf") as NextResponse;
  }
  if (m === "POST" && (p = path.match(/^\/quotes\/(\d{1,18})\/accept$/))) {
    const b = await readJson(req, AcceptBody);
    return json(await decideQuote(s, p[1], "accepted", { name: b.name }, meta, portalBase(req)));
  }
  if (m === "POST" && (p = path.match(/^\/quotes\/(\d{1,18})\/decline$/))) {
    const b = await readJson(req, DeclineBody);
    return json(await decideQuote(s, p[1], "declined", { reason: b.reason }, meta, portalBase(req)));
  }
  if (m === "POST" && (p = path.match(/^\/invoices\/(\d{1,18})\/proof$/))) {
    if (Number(req.headers.get("content-length") ?? 0) > MAX_UPLOAD + 64 * 1024) throw new HttpError(413, "Files can be at most 4 MB.");
    let form: FormData;
    try { form = await req.formData(); } catch { throw new HttpError(400, "Send the form again."); }
    const r = ProofFields.safeParse(Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string")));
    if (!r.success) throw new HttpError(400, r.error.issues[0]?.message ?? "Check the form.");
    const file = form.get("file");
    return json(await paymentNotice(s, p[1], r.data, file instanceof File ? file : null, meta, portalBase(req)));
  }
  throw new HttpError(404, "Not found.");
});

export const GET = run;
export const POST = run;
