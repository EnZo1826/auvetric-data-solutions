import type { NextRequest } from "next/server";
import { handle, json } from "@/crm/server/http";
import { dispatch } from "@/crm/server/router";
import "@/crm/server/api/routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const run = handle(async (req: NextRequest) => {
  const path = "/" + req.nextUrl.pathname.replace(/^\/api\/crm\/?/, "").replace(/\/+$/, "");
  return json(await dispatch(req, path));
});

export const GET = run;
export const POST = run;
export const PUT = run;
export const PATCH = run;
export const DELETE = run;
