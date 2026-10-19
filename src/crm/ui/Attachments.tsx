"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Eye, Paperclip, Trash2, Upload } from "lucide-react";
import { crmFetch } from "./api";
import { canWrite, errText, useCrm } from "./store";
import { confirmAction } from "./ui";
import { formatDate } from "@/crm/shared/calc";

export type AttachEntity = "client" | "project" | "document" | "lead" | "expense" | "enquiry";
export type AttachmentRow = { id: string; name: string; content_type: string; size: number; created_at: string; uploaded_by_name: string | null };

const MAX = 4 * 1024 * 1024;
const INLINE = /\.(pdf|png|jpe?g|webp|gif)$/i;
export const fmtSize = (n: number) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

/** Files attached to one record: list, upload (button or drop), open, download, delete. */
export function AttachmentsPanel({ entity, entityId, title = "Files", onChange }: { entity: AttachEntity; entityId: string; title?: string; onChange?: (rows: AttachmentRow[]) => void }) {
  const { me, toast } = useCrm();
  const [rows, setRows] = useState<AttachmentRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const rw = canWrite(me?.role);
  const load = useCallback(() => crmFetch<AttachmentRow[]>(`/api/crm/attachments?entity=${entity}&id=${entityId}`).then((r) => { setRows(r); onChange?.(r); }).catch((e) => toast(errText(e), "err")), [entity, entityId, toast, onChange]);
  useEffect(() => { load(); }, [load]);

  const upload = async (files: FileList | File[]) => {
    for (const f of Array.from(files)) {
      if (f.size > MAX) { toast(`${f.name} is larger than 4 MB.`, "err"); continue; }
      setBusy(f.name);
      try {
        const fd = new FormData();
        fd.set("entity", entity); fd.set("entity_id", entityId); fd.set("file", f);
        await crmFetch("/api/crm/attachments", { method: "POST", body: fd });
      } catch (e) { toast(`${f.name}: ${errText(e)}`, "err"); }
    }
    setBusy(null);
    if (input.current) input.current.value = "";
    load();
  };
  const del = async (a: AttachmentRow) => {
    if (!confirmAction(`Delete ${a.name}?`)) return;
    try { await crmFetch(`/api/crm/attachments/${a.id}`, { method: "DELETE" }); load(); } catch (e) { toast(errText(e), "err"); }
  };

  return (
    <section className="stack" style={{ gap: 8 }} aria-label={title}
      onDragOver={(e) => { if (rw && e.dataTransfer.types.includes("Files")) { e.preventDefault(); setOver(true); } }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { if (!rw) return; e.preventDefault(); setOver(false); upload(e.dataTransfer.files); }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h3 style={{ margin: 0, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}><Paperclip aria-hidden style={{ width: 14, height: 14, flex: "none" }} /> {title}{rows?.length ? ` (${rows.length})` : ""}</h3>
        {rw && <>
          <input ref={input} type="file" multiple hidden onChange={(e) => e.target.files && upload(e.target.files)} aria-label={`Upload files to ${title.toLowerCase()}`} />
          <button type="button" className="sm" disabled={!!busy} onClick={() => input.current?.click()}><Upload /> {busy ? "Uploading…" : "Upload"}</button>
        </>}
      </div>
      <div style={{ border: `1px dashed ${over ? "var(--brand)" : "var(--line)"}`, borderRadius: 8, padding: rows?.length ? 0 : 10, background: over ? "rgba(0,105,245,.08)" : undefined }}>
        {rows === null ? <div className="dim" style={{ fontSize: 12, padding: 8 }}>Loading…</div>
          : !rows.length ? <div className="dim" style={{ fontSize: 12 }}>{rw ? "No files yet. Drop files here or use Upload (max 4 MB each)." : "No files."}</div>
          : <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>{rows.map((a) => (
            <li key={a.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 8px", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <a href={`/api/crm/attachments/${a.id}/download`} style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={a.name}>{a.name}</a>
                <div className="dim" style={{ fontSize: 11 }}>{fmtSize(a.size)} · {formatDate(a.created_at.slice(0, 10))}{a.uploaded_by_name ? ` · ${a.uploaded_by_name.split(" ")[0]}` : ""}</div>
              </div>
              {INLINE.test(a.name) && <a className="btn ghost icon sm" href={`/api/crm/attachments/${a.id}/download?inline=1`} target="_blank" rel="noopener" aria-label={`Open ${a.name}`}><Eye /></a>}
              <a className="btn ghost icon sm" href={`/api/crm/attachments/${a.id}/download`} aria-label={`Download ${a.name}`}><Download /></a>
              {rw && <button type="button" className="ghost icon sm" aria-label={`Delete ${a.name}`} onClick={() => del(a)}><Trash2 /></button>}
            </li>
          ))}</ul>}
      </div>
    </section>
  );
}
