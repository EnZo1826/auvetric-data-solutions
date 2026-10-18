import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { agency } from "@/data/agency";
import { organizationJsonLd } from "@/lib/seo";

const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk", display: "swap" });
const sans = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap", weight: ["400", "500"] });

export const metadata: Metadata = {
  metadataBase: new URL(agency.url),
  title: {
    default: `${agency.name} — We connect systems. We engineer intelligence.`,
    template: `%s · ${agency.shortName}`,
  },
  description: agency.description,
  applicationName: agency.name,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: agency.name,
    title: `${agency.name} — We connect systems. We engineer intelligence.`,
    description: agency.description,
    locale: "en_NA",
  },
  twitter: { card: "summary_large_image" },
  robots: { index: process.env.NEXT_PUBLIC_ALLOW_INDEXING === "true", follow: true },
};

export const viewport: Viewport = {
  themeColor: "#07090D",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const jsonLd = organizationJsonLd();
  return (
    <html lang="en-NA" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body className="min-h-dvh">
        <SiteHeader />
        <main id="main" tabIndex={-1} className="outline-none">
          {children}
        </main>
        <SiteFooter />
        {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />}
      </body>
    </html>
  );
}
