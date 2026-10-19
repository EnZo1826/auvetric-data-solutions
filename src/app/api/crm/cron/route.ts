import type { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { audit, handle, HttpError, json } from "@/crm/server/http";
import { dailyRun } from "@/crm/server/documents";
import { runBackup } from "@/crm/server/backup";

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
  // Nightly backup. A failure is recorded (and shows in Settings → Backups as a missing night) but doesn't fail the daily job.
  let backup: { id: string; size: number; pruned: number } | { error: string };
  try {
    const b = await runBackup("nightly", null);
    backup = { id: String(b.id), size: Number(b.size), pruned: b.pruned };
    await audit(null, "backup.nightly", null, backup);
  } catch (e) {
    console.error("[crm] nightly backup failed", e);
    backup = { error: (e as Error).message.slice(0, 300) };
    await audit(null, "backup.failed", null, backup);
  }
  return json({ ...r, backup });
});
