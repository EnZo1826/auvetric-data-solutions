"use client";

import { useState } from "react";
import { Download, Mail } from "lucide-react";
import { EmailDialog } from "./EmailDialog";
import { Toasts } from "./ui";

/** Statement print bar: download the PDF or email it to the client. */
export function StatementActions({ clientId, from, to, canSend }: { clientId: string; from: string; to: string; canSend: boolean }) {
  const [open, setOpen] = useState(false);
  const qs = new URLSearchParams({ from, to });
  return (
    <>
      <a className="btn sm" href={`/api/crm/clients/${clientId}/statement/pdf?${qs}`} download><Download /> PDF</a>
      {canSend && <button className="sm" onClick={() => setOpen(true)}><Mail /> Email</button>}
      {open && <EmailDialog kind="statement" clientId={clientId} from={from} to={to} onClose={() => setOpen(false)} onSent={() => setOpen(false)} />}
      <Toasts />
    </>
  );
}
