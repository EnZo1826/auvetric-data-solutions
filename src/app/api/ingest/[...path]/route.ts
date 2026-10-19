import type { NextRequest } from "next/server";
import { handle, json } from "@/crm/server/http";
import { dispatchIngest } from "@/crm/server/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** n8n → CRM ingest API. Token-authenticated; see src/crm/server/ingest.ts. */
const run = handle(async (req: NextRequest) => {
  const path = "/" + req.nextUrl.pathname.replace(/^\/api\/ingest\/?/, "").replace(/\/+$/, "");
  const res = json(await dispatchIngest(req, path));
  res.headers.set("X-Robots-Tag", "noindex");
  return res;
});

export const GET = run;
export const POST = run;
export const PATCH = run;
