import type { MetadataRoute } from "next";
import { agency } from "@/data/agency";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  // Set NEXT_PUBLIC_ALLOW_INDEXING=true only on the production domain.
  const allow = process.env.NEXT_PUBLIC_ALLOW_INDEXING === "true";
  return {
    rules: allow ? [{ userAgent: "*", allow: "/", disallow: "/api/" }] : [{ userAgent: "*", disallow: "/" }],
    sitemap: `${agency.url.replace(/\/$/, "")}/sitemap.xml`,
  };
}
