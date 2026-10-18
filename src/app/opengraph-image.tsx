import { ImageResponse } from "next/og";

export const dynamic = "force-static";
export const alt = "NEXUS / INTELLIGENCE — We connect systems. We engineer intelligence.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#07090D", color: "#F3F6FA", fontFamily: "sans-serif", position: "relative" }}>
        <div style={{ position: "absolute", left: -120, top: 180, width: 520, height: 520, borderRadius: 520, background: "rgba(218,54,51,0.22)", filter: "blur(90px)" }} />
        <div style={{ position: "absolute", right: -120, top: 120, width: 520, height: 520, borderRadius: 520, background: "rgba(0,200,215,0.20)", filter: "blur(90px)" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 30, letterSpacing: 2 }}>
          <svg width="56" height="56" viewBox="0 0 32 32">
            <path d="M4 8 L13 16 L4 24" fill="none" stroke="#DA3633" strokeWidth="2.2" />
            <path d="M28 8 L19 16 L28 24" fill="none" stroke="#00C8D7" strokeWidth="2.2" />
            <circle cx="16" cy="16" r="3.2" fill="#F3F6FA" />
          </svg>
          NEXUS / INTELLIGENCE
        </div>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 84, fontWeight: 700, lineHeight: 1.0, letterSpacing: -3 }}>
          <span>We connect systems.</span>
          <span style={{ color: "#99A8BA" }}>We engineer intelligence.</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, color: "#99A8BA" }}>
          <span><span style={{ color: "#F2716D" }}>Engineering</span> × <span style={{ color: "#3FDBE6" }}>Data</span> × Intelligence</span>
          <span>Windhoek, Namibia</span>
        </div>
      </div>
    ),
    size,
  );
}
