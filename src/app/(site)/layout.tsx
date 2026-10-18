import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { organizationJsonLd } from "@/lib/seo";

/** Public website chrome. The CRM under /crm has its own layout. */
export default function SiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const jsonLd = organizationJsonLd();
  return (
    <>
      <SiteHeader />
      <main id="main" tabIndex={-1} className="outline-none">
        {children}
      </main>
      <SiteFooter />
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />}
    </>
  );
}
