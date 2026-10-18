import type { NextRequest } from "next/server";
import { handle, json, sessionFor } from "@/crm/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req: NextRequest) => {
  const s = await sessionFor(req);
  return json({ user: s.user });
});
