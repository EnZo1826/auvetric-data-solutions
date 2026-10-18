import type { MetadataRoute } from "next";
import { agency } from "@/data/agency";
import { practices } from "@/data/practices";
import { caseStudies } from "@/data/projects";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = agency.url.replace(/\/$/, "");
  const fixed = ["", "/solutions", "/industries", "/work", "/approach", "/about", "/insights", "/contact", "/lab", "/privacy", "/terms"];
  return [
    ...fixed.map((p) => ({ url: `${base}${p}`, changeFrequency: "monthly" as const, priority: p === "" ? 1 : 0.7 })),
    ...practices.map((p) => ({ url: `${base}/solutions/${p.slug}`, changeFrequency: "monthly" as const, priority: 0.8 })),
    ...caseStudies.map((c) => ({ url: `${base}/work/${c.slug}`, changeFrequency: "monthly" as const, priority: 0.6 })),
  ];
}
