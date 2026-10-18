import { requireSession } from "@/crm/server/page-auth";
import { CrmShell } from "@/crm/ui/Shell";

export const dynamic = "force-dynamic";

export default async function CrmAppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { user } = await requireSession();
  return <CrmShell user={{ name: user.name, email: user.email, role: user.role }}>{children}</CrmShell>;
}
