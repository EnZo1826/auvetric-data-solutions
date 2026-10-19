import type { Metadata } from "next";
import Link from "next/link";
import "@/crm/crm.css";

export const metadata: Metadata = {
  title: { default: "Client portal", template: "%s · Auvetric client portal" },
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "same-origin",
};
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export default function PortalLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="crm portal">
      <a href="#portal-main" className="skip-link">Skip to content</a>
      <header className="portal-top">
        <Link href="/portal" className="portal-brand" aria-label="Auvetric client portal home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${basePath}/brand/auvetric-mark.png`} alt="" width={28} height={28} />
          <span><b>AUVETRIC</b> <small>Client portal</small></span>
        </Link>
      </header>
      <main id="portal-main" className="portal-main" tabIndex={-1}>{children}</main>
      <footer className="portal-foot">Auvetric Data Solutions · Windhoek, Namibia · <Link href="/privacy">Privacy</Link></footer>
    </div>
  );
}
