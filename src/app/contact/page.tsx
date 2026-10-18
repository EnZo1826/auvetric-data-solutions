import { PageHero } from "@/components/sections/CtaBand";
import Link from "next/link";
import { Suspense } from "react";
import { ContactIntentForm } from "@/components/forms/ContactIntentForm";
import { Container, Section } from "@/components/ui/primitives";
import { agency } from "@/data/agency";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  title: "Contact",
  description: "Discuss a project, request a consultation, explore a partnership or send a general enquiry.",
  path: "/contact",
});

export default function ContactPage() {
  const staticSite = process.env.NEXT_PUBLIC_STATIC_SITE === "true";
  // Public by design: a Web3Forms access key only lets this form deliver to the registered mailbox.
  const relayKey = process.env.NEXT_PUBLIC_WEB3FORMS_KEY || "";

  return (
    <>
      <PageHero
        title={<>Let’s build something<br /><span className="text-mute">that works.</span></>}
        intro="Tell us about the problem, the systems involved and what a good outcome looks like. We read every enquiry ourselves and reply personally."
      />
      <Section className="pt-14 sm:pt-16">
        <Container className="grid gap-14 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]">
          <div className="relative rounded-3xl border border-line bg-panel p-6 sm:p-10">
            {staticSite && relayKey ? (
              <Suspense fallback={<p className="text-mute">Loading enquiry form…</p>}><ContactIntentForm relayKey={relayKey} /></Suspense>
            ) : staticSite ? <div>
              <h2 className="font-display text-2xl text-ink">Enquiries are not available on this static preview</h2>
              <p className="mt-4 leading-relaxed text-mute">This website is hosted on GitHub Pages, which cannot run the secure enquiry backend. The demonstrations remain fully interactive. Online enquiries will be enabled when a delivery service and public contact details are confirmed.</p>
              {agency.contact.email && <a href={`mailto:${agency.contact.email}`} className="mt-6 inline-block text-data-ink underline">Email {agency.contact.email}</a>}
              <Link href="/lab" className="mt-6 block text-ink underline">Explore the Solution Laboratory</Link>
            </div> : <>
              {!process.env.CONTACT_PROVIDER && <p className="mb-6 rounded-xl border border-warn/30 bg-warn/[0.06] p-4 text-sm text-warn">Preview mode: enquiry delivery has not been configured. This form will not claim your message was sent.</p>}
              <Suspense fallback={<p className="text-mute">Loading enquiry form…</p>}><ContactIntentForm /></Suspense>
            </>}
          </div>
          <aside className="space-y-8 text-sm">
            <div>
              <h2 className="font-mono text-xs uppercase tracking-[0.14em] text-dim">What happens next</h2>
              <ol className="mt-4 space-y-4">
                {[
                  ["We read your enquiry", "Both partners review it, so the engineering and the data side are considered from the start."],
                  ["A short discovery call", "To understand the operation, the systems and the constraints."],
                  ["A written proposal", "Scope, approach, phasing and cost — or an honest recommendation if we are not the right fit."],
                ].map(([t, d], i) => (
                  <li key={t} className="grid grid-cols-[2rem_1fr] gap-2">
                    <span className="font-mono text-dim">{String(i + 1).padStart(2, "0")}</span>
                    <div><p className="text-ink">{t}</p><p className="mt-1 text-mute">{d}</p></div>
                  </li>
                ))}
              </ol>
            </div>
            <div className="border-t border-line pt-8">
              <h2 className="font-mono text-xs uppercase tracking-[0.14em] text-dim">Location</h2>
              <p className="mt-3 text-ink">{agency.location.city}, {agency.location.country}</p>
              <p className="text-mute">{agency.location.timezone}</p>
              <p className="mt-3 text-mute">{agency.servingRegions}</p>
              {agency.contact.email && <p className="mt-3"><a href={`mailto:${agency.contact.email}`} className="text-ink underline">{agency.contact.email}</a></p>}
            </div>
            <div className="border-t border-line pt-8 text-xs leading-relaxed text-dim">
              Your details are used only to respond to your enquiry. See the <Link href="/privacy" className="underline">privacy notice</Link>.
            </div>
          </aside>
        </Container>
      </Section>
    </>
  );
}
