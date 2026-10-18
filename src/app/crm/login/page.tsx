import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentSession } from "@/crm/server/page-auth";
import { dbConfigured } from "@/crm/server/db";
import { nextStep } from "@/crm/server/signin";
import { LoginFlow } from "@/crm/ui/LoginFlow";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (!dbConfigured()) {
    return (
      <div className="auth">
        <div className="auth-card"><div className="card err-box">The CRM database isn&apos;t configured on this deployment.</div></div>
      </div>
    );
  }
  const s = await currentSession();
  if (s?.stage === "full") redirect("/crm");
  // A half-finished sign-in (e.g. page refreshed on the 2FA step) resumes where it stopped.
  const initial = s ? nextStep[s.stage] : "login";
  return <LoginFlow initial={initial === "done" ? "login" : initial} email={s?.user.email ?? ""} />;
}
