"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  Banknote, BarChart3, Boxes, Building2, FileText, FolderKanban, Inbox, KanbanSquare, Landmark, LayoutDashboard,
  ListChecks, LogOut, Menu, Moon, Plug, Radar, Receipt, Repeat, ScrollText, Settings, Store, Sun, Timer, UserCog, Users, Wallet,
  type LucideIcon,
} from "lucide-react";
import { NAV, isBuilt } from "@/crm/nav";
import { crmFetch } from "./api";
import { useCrm } from "./store";
import { Toasts } from "./ui";

const ICONS: Record<string, LucideIcon> = {
  Banknote, BarChart3, Boxes, Building2, FileText, FolderKanban, Inbox, KanbanSquare, Landmark, LayoutDashboard,
  ListChecks, Plug, Radar, Receipt, Repeat, ScrollText, Settings, Store, Timer, UserCog, Users, Wallet,
};
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

function useOnline() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    setOn(navigator.onLine);
    const a = () => setOn(true), b = () => setOn(false);
    window.addEventListener("online", a);
    window.addEventListener("offline", b);
    return () => { window.removeEventListener("online", a); window.removeEventListener("offline", b); };
  }, []);
  return on;
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => setTheme(document.documentElement.dataset.crmTheme === "light" ? "light" : "dark"), []);
  const flip = () => {
    const t = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.crmTheme = t;
    try { localStorage.setItem("auv-crm-theme", t); } catch { /* private mode */ }
    setTheme(t);
  };
  return (
    <button className="ghost icon" onClick={flip} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} title="Toggle theme">
      {theme === "dark" ? <Sun /> : <Moon />}
    </button>
  );
}

type Me = { id: string; name: string; email: string; role: "admin" | "member" | "readonly" };

export function CrmShell({ user, children }: { user: Me; children: ReactNode }) {
  const pathname = usePathname();
  const setMe = useCrm((s) => s.setMe);
  useEffect(() => setMe(user), [user, setMe]);
  const [open, setOpen] = useState(false);
  const online = useOnline();
  useEffect(() => setOpen(false), [pathname]);
  // Keyboard access for clickable rows/cards (`.click` elements open a record): focusable, Enter/Space activates.
  useEffect(() => {
    const root = document.getElementById("main");
    if (!root) return;
    const mark = () => root.querySelectorAll<HTMLElement>(".click:not([tabindex])").forEach((el) => { el.tabIndex = 0; });
    mark();
    const mo = new MutationObserver(mark);
    mo.observe(root, { childList: true, subtree: true });
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if ((e.key === "Enter" || e.key === " ") && t.classList?.contains("click") && t === document.activeElement) { e.preventDefault(); t.click(); }
    };
    root.addEventListener("keydown", key);
    return () => { mo.disconnect(); root.removeEventListener("keydown", key); };
  }, []);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open]);

  const slug = pathname.replace(/^\/crm\/?/, "").split("/")[0] ?? "";
  const current = NAV.flatMap((g) => g.items).find((i) => i.slug === slug);

  const signOut = async () => {
    await crmFetch("/api/crm/auth/logout", { method: "POST", body: {} }).catch(() => {});
    window.location.assign("/crm/login");
  };

  return (
    <div className="shell">
      <a href="#main" className="skip-link">Skip to content</a>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <aside className={"side" + (open ? " open" : "")} aria-label="CRM navigation">
        <Link href="/crm" className="brand" style={{ textDecoration: "none" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${basePath}/brand/auvetric-mark.png`} alt="" width={30} height={30} />
          <span><b>AUVETRIC</b><small>CRM</small></span>
        </Link>
        <nav>
          {NAV.map((g) => (
            <div key={g.label}>
              <div className="grp">{g.label}</div>
              {g.items.map((n) => {
                const Icon = ICONS[n.icon] ?? LayoutDashboard;
                const href = n.slug ? `/crm/${n.slug}` : "/crm";
                const active = n.slug === slug;
                const built = isBuilt(n.slug);
                return (
                  <Link key={n.slug} href={href} className={(active ? "active " : "") + (built ? "" : "sched")} aria-current={active ? "page" : undefined}>
                    <Icon aria-hidden />
                    {n.label}
                    {!built && <span className="ph" title={`Scheduled for phase ${n.phase}`}>P{n.phase}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="foot">
          <div><div className="who">{user.name}</div><div className="dim">{user.email}</div></div>
          <button className="sm" onClick={signOut}><LogOut aria-hidden /> Sign out</button>
        </div>
      </aside>
      <div className="main">
        {!online && <div className="offline">Offline. Changes need a connection.</div>}
        <header className="topbar">
          <button className="menu icon" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open}><Menu /></button>
          <span className="crumb">{current?.label ?? "CRM"}</span>
          <div className="grow" />
          <Link href="/" className="dim" style={{ fontSize: 12 }}>auvetric.com ↗</Link>
          <ThemeToggle />
        </header>
        <main className="content" id="main" tabIndex={-1}>{children}</main>
      </div>
      <Toasts />
    </div>
  );
}
