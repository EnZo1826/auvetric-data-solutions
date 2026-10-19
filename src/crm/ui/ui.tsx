"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { useCrm } from "./store";
import { formatMoney } from "@/crm/shared/calc";
import type { Currency } from "@/crm/shared/types";

const modalStack: symbol[] = [];

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({ title, onClose, children, footer, wide }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const close = useRef(onClose);
  close.current = onClose;
  // Stack, Escape, scroll lock, focus in / trapped / restored. Runs once per open modal.
  useEffect(() => {
    const me = Symbol("modal");
    modalStack.push(me);
    const opener = document.activeElement as HTMLElement | null;
    const top = () => modalStack[modalStack.length - 1] === me;
    const k = (e: KeyboardEvent) => {
      if (!top()) return;
      if (e.key === "Escape") { e.stopPropagation(); close.current(); return; }
      if (e.key !== "Tab" || !box.current) return;
      const els = [...box.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (!els.length) return;
      const first = els[0], last = els[els.length - 1];
      if (e.shiftKey && (document.activeElement === first || !box.current.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => {
      if (!box.current || box.current.contains(document.activeElement)) return; // autoFocus already placed it
      const firstField = box.current.querySelector<HTMLElement>(".modal-b " + FOCUSABLE.split(", ").join(", .modal-b "));
      (firstField ?? box.current).focus();
    });
    return () => {
      window.removeEventListener("keydown", k);
      const i = modalStack.indexOf(me);
      if (i >= 0) modalStack.splice(i, 1);
      if (!modalStack.length) document.body.style.overflow = "";
      if (opener && document.contains(opener)) opener.focus();
    };
  }, []);
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={box} tabIndex={-1} className={"modal" + (wide ? " wide" : "")} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="modal-h">
          <h2 id={titleId}>{title}</h2>
          <button className="ghost icon" onClick={onClose} aria-label="Close"><X /></button>
        </div>
        <div className="modal-b">{children}</div>
        {footer && <div className="modal-f">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, children, className, hint }: { label: string; children: ReactNode; className?: string; hint?: ReactNode }) {
  return (
    <label className={"field " + (className ?? "")}>
      <span>{label}</span>
      {children}
      {hint && <small className="dim" style={{ fontSize: 11 }}>{hint}</small>}
    </label>
  );
}

const STATUS_TONE: Record<string, string> = {
  draft: "", sent: "info", paid: "ok", accepted: "ok", overdue: "err", declined: "err", cancelled: "mute", invoiced: "violet",
  urgent: "err", high: "warn", normal: "info", low: "",
};
export function StatusBadge({ s }: { s: string }) {
  return <span className={"badge " + (STATUS_TONE[s] ?? "")} style={{ textTransform: "capitalize" }}>{s.replace(/_/g, " ")}</span>;
}

export function Money({ v, c, muted }: { v: number; c: Currency | string; muted?: boolean }) {
  return <span className={"tabular" + (muted ? " muted" : "")} style={{ whiteSpace: "nowrap" }}>{formatMoney(v, c)}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function Toasts() {
  const toasts = useCrm((s) => s.toasts);
  return (
    <div className="toasts" aria-live="polite" role="status">
      {toasts.map((t) => <div key={t.id} className={"toast " + t.kind} role={t.kind === "err" ? "alert" : undefined}>{t.text}</div>)}
    </div>
  );
}

export function PageHead({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return <div className="page-head"><h1>{title}</h1>{children}</div>;
}

export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: { key: T; label: ReactNode }[] }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.key} role="tab" aria-selected={value === t.key} className={value === t.key ? "on" : ""} onClick={() => onChange(t.key)}>{t.label}</button>
      ))}
    </div>
  );
}

export const confirmAction = (msg: string) => window.confirm(msg);
