"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { nav, agency } from "@/data/agency";
import { AgencyLogo } from "@/components/ui/AgencyLogo";
import { cx } from "@/components/ui/primitives";

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header
      className={cx(
        "fixed inset-x-0 top-0 z-50 transition-[background,border-color,backdrop-filter] duration-500",
        scrolled || open ? "border-b border-line bg-void/85 backdrop-blur-xl" : "border-b border-transparent",
      )}
    >
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-ink focus:px-4 focus:py-2 focus:text-void">
        Skip to content
      </a>
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-6 px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-3" aria-label={`${agency.name} — home`}>
          <AgencyLogo />
        </Link>

        <nav aria-label="Primary" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {nav.slice(1).map((n) => (
              <li key={n.href}>
                <Link
                  href={n.href}
                  aria-current={isActive(n.href) ? "page" : undefined}
                  className={cx(
                    "relative rounded-full px-3.5 py-2 text-[0.88rem] transition-colors",
                    isActive(n.href) ? "text-ink" : "text-mute hover:text-ink",
                  )}
                >
                  {n.label}
                  {isActive(n.href) && <span aria-hidden className="absolute inset-x-3.5 -bottom-[13px] h-px bg-gradient-to-r from-eng to-data" />}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/contact?intent=project"
            className="hidden min-h-10 items-center rounded-full bg-ink px-5 text-[0.88rem] font-medium text-void transition-colors hover:bg-white sm:inline-flex"
          >
            Start a Project
          </Link>
          <button
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-full border border-line-strong text-ink lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      <div id="mobile-nav" hidden={!open} className="h-[calc(100dvh-4rem)] overflow-y-auto border-t border-line bg-void lg:hidden">
        <nav aria-label="Mobile" className="px-5 py-6">
          <ul className="divide-y divide-line">
            {nav.map((n) => (
              <li key={n.href}>
                <Link
                  href={n.href}
                  aria-current={isActive(n.href) ? "page" : undefined}
                  className={cx("flex items-center justify-between py-4 font-display text-2xl", isActive(n.href) ? "text-ink" : "text-mute")}
                >
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/contact?intent=project" className="mt-8 flex min-h-12 items-center justify-center rounded-full bg-ink font-medium text-void">
            Start a Project
          </Link>
        </nav>
      </div>
    </header>
  );
}
