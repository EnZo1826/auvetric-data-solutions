import type { Metadata } from "next";
import { agency } from "@/data/agency";

export function pageMeta({ title, description, path }: { title: string; description: string; path: string }): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title: `${title} · ${agency.shortName}`, description, url: path },
  };
}

/**
 * Organisation structured data is only emitted once the legal entity is confirmed
 * (set agency.legalName). Until then a minimal, non-claiming ProfessionalService entry is used.
 */
export function organizationJsonLd() {
  if (!agency.legalName) return null;
  return {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: agency.legalName ?? agency.name,
    url: agency.url,
    description: agency.description,
    areaServed: agency.servingRegions,
    address: { "@type": "PostalAddress", addressLocality: agency.location.city, addressCountry: "NA" },
    sameAs: [agency.social.github, agency.social.linkedin].filter(Boolean),
  };
}
