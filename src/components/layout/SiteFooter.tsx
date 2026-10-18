import Link from "next/link";
import { agency } from "@/data/agency";
import { practices } from "@/data/practices";
import { AgencyLogo } from "@/components/ui/AgencyLogo";
import { Container } from "@/components/ui/primitives";

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="relative border-t border-line bg-base">
      <div className="convergence-rule" />
      <Container className="grid gap-12 py-16 md:grid-cols-12">
        <div className="md:col-span-4">
          <div className="flex items-center gap-3">
            <AgencyLogo className="w-56" />
          </div>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-mute">{agency.description}</p>
          <p className="mt-5 font-mono text-xs text-dim">
            {agency.location.city}, {agency.location.country} · {agency.location.timezone}
          </p>
        </div>

        <nav aria-label="Practices" className="md:col-span-3">
          <h2 className="font-mono text-xs uppercase tracking-[0.14em] text-dim">Practices</h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            {practices.map((p) => (
              <li key={p.slug}>
                <Link href={`/solutions/${p.slug}`} className="text-mute hover:text-ink">
                  {p.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Explore" className="md:col-span-2">
          <h2 className="font-mono text-xs uppercase tracking-[0.14em] text-dim">Explore</h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            {[
              ["/lab", "Solution Laboratory"],
              ["/work", "Work"],
              ["/industries", "Industries"],
              ["/approach", "Our Approach"],
              ["/about", "About"],
              ["/insights", "Insights"],
            ].map(([href, label]) => (
              <li key={href}>
                <Link href={href} className="text-mute hover:text-ink">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="md:col-span-3">
          <h2 className="font-mono text-xs uppercase tracking-[0.14em] text-dim">Engage</h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><Link href="/contact?intent=project" className="text-mute hover:text-ink">Discuss a project</Link></li>
            <li><Link href="/contact?intent=consultation" className="text-mute hover:text-ink">Request a consultation</Link></li>
            <li><Link href="/contact?intent=partnership" className="text-mute hover:text-ink">Explore a partnership</Link></li>
            {agency.contact.email && (
              <li><a href={`mailto:${agency.contact.email}`} className="text-mute hover:text-ink">{agency.contact.email}</a></li>
            )}
            <li><a href={agency.social.github} className="text-mute hover:text-ink" target="_blank" rel="noreferrer noopener">GitHub</a></li>
          </ul>
        </div>
      </Container>
      <Container className="flex flex-col gap-3 border-t border-line py-6 text-xs text-dim sm:flex-row sm:items-center sm:justify-between">
        <p>© {year} {agency.legalName ?? agency.name}. Legal entity details to be confirmed.</p>
        <p className="flex gap-5">
          <Link href="/privacy" className="hover:text-ink">Privacy</Link>
          <Link href="/terms" className="hover:text-ink">Terms</Link>
          <span>Interactive demonstrations use synthetic data.</span>
        </p>
      </Container>
    </footer>
  );
}
