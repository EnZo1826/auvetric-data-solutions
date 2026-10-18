/** Page-side guard for /crm server components. API routes use sessionFor() instead. */
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE, readSession, type Session } from "./session";

export const currentSession = cache(async (): Promise<Session | null> => {
  const jar = await cookies();
  return readSession(jar.get(COOKIE)?.value);
});

/** Full session or a redirect to the sign-in page. Call at the top of every CRM page. */
export async function requireSession(): Promise<Session> {
  const s = await currentSession();
  if (!s || s.stage !== "full") redirect("/crm/login");
  return s;
}
