/**
 * Agency configuration. Auvetric Data Solutions is the confirmed public brand.
 * Legal registration and public contact details still require confirmation.
 * Anything marked `null` is intentionally unpublished until verified.
 */
export const agency = {
  name: "Auvetric Data Solutions",
  shortName: "Auvetric",
  legalName: null as string | null, // Set only after legal registration is confirmed
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  futureDomain: "auvetric.com", // Planned migration only; current hosting/canonicals stay unchanged.
  statement: "We connect systems. We engineer intelligence.",
  secondary: [
    "From physical operations to actionable intelligence.",
    "Engineering the connection between technology, data, and business.",
    "Built for complex problems. Designed for real operations.",
    "Your operations, systems, and data — working together.",
  ],
  description:
    "A two-partner technology development and consultancy practice in Windhoek, Namibia. We combine systems engineering with data and business-intelligence expertise to connect operational technology, enterprise systems and reliable data.",
  location: {
    city: "Windhoek",
    country: "Namibia",
    timezone: "Africa/Windhoek (UTC+2)",
  },
  contact: {
    // Set NEXT_PUBLIC_CONTACT_EMAIL in .env once a mailbox exists. Not shown when unset.
    email: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? null,
    phone: null as string | null,
  },
  social: {
    github: "https://github.com/EnZo1826",
    linkedin: null as string | null,
  },
  servingRegions: "Namibia, Southern Africa and international clients (remote delivery)",
} as const;

export const nav = [
  { href: "/", label: "Home" },
  { href: "/solutions", label: "Solutions" },
  { href: "/industries", label: "Industries" },
  { href: "/work", label: "Work" },
  { href: "/approach", label: "Our Approach" },
  { href: "/about", label: "About" },
  { href: "/insights", label: "Insights" },
  { href: "/contact", label: "Contact" },
] as const;
