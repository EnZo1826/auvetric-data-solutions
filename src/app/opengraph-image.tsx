import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { agency } from "@/data/agency";

export const dynamic = "force-static";
export const alt = "Auvetric Data Solutions — We connect systems. We engineer intelligence.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const logo = await readFile(join(process.cwd(), "public/brand/auvetric-lockup-dark.png"));
  const logoData = `data:image/png;base64,${logo.toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#050b18", color: "#f3f7ff", fontFamily: "sans-serif", position: "relative" }}>
        <div style={{ position: "absolute", left: -120, top: 180, width: 520, height: 520, borderRadius: 520, background: "rgba(0,105,245,0.22)", filter: "blur(90px)" }} />
        <div style={{ position: "absolute", right: -120, top: 120, width: 520, height: 520, borderRadius: 520, background: "rgba(0,212,234,0.20)", filter: "blur(90px)" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 30, letterSpacing: 2 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoData} width={400} height={93} alt={agency.name} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 84, fontWeight: 700, lineHeight: 1.0, letterSpacing: -3 }}>
          <span>We connect systems.</span>
          <span style={{ color: "#9dafc8" }}>We engineer intelligence.</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, color: "#9dafc8" }}>
          <span><span style={{ color: "#77b5ff" }}>Engineering</span> × <span style={{ color: "#5ae7f2" }}>Data</span> × Intelligence</span>
          <span>Windhoek, Namibia</span>
        </div>
      </div>
    ),
    size,
  );
}
