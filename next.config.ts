import type { NextConfig } from "next";

const pages = process.env.NEXUS_PAGES_BUILD === "true";
const nextConfig: NextConfig = {
  ...(pages ? {
    output: "export" as const,
    basePath: process.env.NEXT_PUBLIC_BASE_PATH || "/auvetric-data-solutions",
    trailingSlash: true,
    images: { unoptimized: true },
  } : {}),
};

export default nextConfig;
