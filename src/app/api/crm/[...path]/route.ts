import type { NextRequest } from "next/server";
import { handle, json } from "@/crm/server/http";
import { dispatch } from "@/crm/server/router";
import "@/crm/server/api/routes";
import "@/crm/server/api/sales";
import "@/crm/server/api/finance";
import "@/crm/server/api/insights";
import "@/crm/server/api/portal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const run = handle(async (req: NextRequest) => {
  const path = "/" + req.nextUrl.pathname.replace(/^\/api\/crm\/?/, "").replace(/\/+$/, "");
  const out = await dispatch(req, path);
  return out instanceof Response ? (out as never) : json(out);
});

export const GET = run;
export const POST = run;
export const PUT = run;
export const PATCH = run;
export const DELETE = run;
