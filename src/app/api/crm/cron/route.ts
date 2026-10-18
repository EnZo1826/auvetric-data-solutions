import type { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { audit, handle, HttpError, json } from "@/crm/server/http";
import { dailyRun } from "@/crm/server/documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily job: generates due auto-retainer invoices and flags overdue invoices.
 * Called by the Netlify scheduled function (netlify/functions/crm-daily.mts) with
 * `Authorization: Bearer $CRM_CRON_SECRET`. Partners can also run it from Retainers.
 */
export const POST = handle(async (req: NextRequest) => {
  const secret = process.env.CRM_CRON_SECRET;
  const got = req.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  if (!secret || secret.length < 24 || got.length !== want.length || !timingSafeEqual(Buffer.from(got), Buffer.from(want))) {
    throw new HttpError(401, "Unauthorized.");
  }
  const r = await dailyRun();
  await audit(null, "cron.daily", null, { created: r.retainers.created.map((x) => x.number), skipped: r.retainers.skipped.length, overdue: r.overdue });
  return json(r);
});
