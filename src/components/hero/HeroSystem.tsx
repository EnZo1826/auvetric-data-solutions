"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, X } from "lucide-react";
import { useInView, useMediaQuery, useReducedMotion, useWebGL } from "@/lib/hooks";
import { cx } from "@/components/ui/primitives";

const CoreScene = dynamic(() => import("./CoreScene"), { ssr: false, loading: () => null });

type Side = "eng" | "data";
interface HeroNode { id: string; label: string; side: Side; text: string; href: string }

const NODES: HeroNode[] = [
  { id: "devices", label: "Industrial devices", side: "eng", text: "Pumps, meters, dispensers and controllers — the physical equipment where operational data originates.", href: "/solutions/engineering-development" },
  { id: "sensors", label: "Sensors", side: "eng", text: "Pressure, flow, level, temperature and pulse signals acquired as reliable, quality-flagged values.", href: "/solutions/engineering-development" },
  { id: "plc", label: "PLCs", side: "eng", text: "Industrial Raspberry Pi PLCs and Modbus devices that sample, scale and act locally.", href: "/solutions/engineering-development" },
  { id: "edge", label: "Edge processors", side: "eng", text: "Gateways that filter, buffer through outages and forward data securely over MQTT.", href: "/solutions/engineering-development" },
  { id: "cloud", label: "Cloud applications", side: "eng", text: "Hosted services, APIs and databases on Linux, Docker and AWS infrastructure.", href: "/solutions/engineering-development" },
  { id: "software", label: "Software services", side: "eng", text: "Offline-first apps, ERPNext integrations and the workflows people use every day.", href: "/solutions/engineering-development" },
  { id: "records", label: "Enterprise records", side: "data", text: "ERP, POS, supplier and distribution-centre records — each with an owner and a level of trust.", href: "/solutions/data-business-intelligence" },
  { id: "pipelines", label: "Data pipelines", side: "data", text: "Repeatable extraction and shaping (Power Query and beyond) instead of one-off spreadsheets.", href: "/solutions/data-business-intelligence" },
  { id: "rules", label: "Validation rules", side: "data", text: "Business rules with reason codes: pack sizes, unit costs, margins, mandatory attributes.", href: "/solutions/data-business-intelligence" },
  { id: "models", label: "Data models", side: "data", text: "KPI models built on validated tables, with lineage back to the source.", href: "/solutions/data-business-intelligence" },
  { id: "analytics", label: "Analytics", side: "data", text: "Power BI and operational dashboards that show both the numbers and how trustworthy they are.", href: "/solutions/data-business-intelligence" },
  { id: "decisions", label: "Business decisions", side: "data", text: "Exceptions routed to accountable owners — automation prepares, people decide.", href: "/solutions/automation-intelligent-systems" },
];

// Geometry in a 760 × 600 viewBox
const W = 760, H = 600, CX = 380, CY = 300, CORE_R = 118;
const PILL_W = 132, PILL_H = 32;
const rowY = (i: number) => 92 + i * 83;
function nodePos(n: HeroNode, i: number) {
  const y = rowY(i);
  const x = n.side === "eng" ? 14 : W - 14 - PILL_W;
  const anchorX = n.side === "eng" ? x + PILL_W : x;
  return { x, y, anchorX, anchorY: y + PILL_H / 2 };
}
function pathFor(n: HeroNode, i: number) {
  const p = nodePos(n, i);
  const dir = n.side === "eng" ? 1 : -1;
  const angle = ((i - 2.5) / 2.5) * 0.62; // spread entry points around the core
  const ex = CX - dir * Math.cos(angle) * CORE_R;
  const ey = CY + Math.sin(angle) * CORE_R;
  const c1x = p.anchorX + dir * 90;
  const c2x = ex - dir * 70;
  return `M ${p.anchorX} ${p.anchorY} C ${c1x} ${p.anchorY}, ${c2x} ${ey}, ${ex} ${ey}`;
}

function StaticCore({ spin }: { spin: boolean }) {
  return (
    <g aria-hidden>
      <circle cx={CX} cy={CY} r={CORE_R + 14} fill="none" stroke="#f3f7ff" strokeOpacity="0.08" />
      <g className={spin ? "spin-slow" : undefined}>
        {Array.from({ length: 96 }).map((_, i) => {
          const a = (i / 96) * Math.PI * 2;
          const r1 = CORE_R + 4, r2 = CORE_R + (i % 8 === 0 ? 16 : 9);
          return <line key={i} x1={CX + Math.cos(a) * r1} y1={CY + Math.sin(a) * r1} x2={CX + Math.cos(a) * r2} y2={CY + Math.sin(a) * r2} stroke="#f3f7ff" strokeOpacity={i % 8 === 0 ? 0.5 : 0.18} />;
        })}
      </g>
      <g className={spin ? "spin-rev" : undefined}>
        <ellipse cx={CX} cy={CY} rx={86} ry={30} fill="none" stroke="#0069f5" strokeOpacity="0.8" transform={`rotate(-28 ${CX} ${CY})`} />
        <ellipse cx={CX} cy={CY} rx={92} ry={36} fill="none" stroke="#00d4ea" strokeOpacity="0.8" transform={`rotate(32 ${CX} ${CY})`} />
      </g>
      <circle cx={CX} cy={CY} r={42} fill="none" stroke="#f3f7ff" strokeOpacity="0.35" strokeDasharray="2 5" />
      <circle cx={CX} cy={CY} r={15} fill="#f3f7ff" />
      <circle cx={CX} cy={CY} r={26} fill="url(#coreGlow)" />
    </g>
  );
}

export function HeroSystem() {
  const reduced = useReducedMotion();
  const webgl = useWebGL();
  const wide = useMediaQuery("(min-width: 640px)");
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const inView = useInView(wrapRef);
  const [near, setNear] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const indexed = useMemo(() => {
    const eng = NODES.filter((n) => n.side === "eng");
    const data = NODES.filter((n) => n.side === "data");
    return [...eng.map((n, i) => ({ n, i })), ...data.map((n, i) => ({ n, i }))];
  }, []);

  const onMove = useCallback(
    (e: React.PointerEvent) => {
      const svg = svgRef.current;
      if (!svg) return;
      const r = svg.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * W;
      const y = ((e.clientY - r.top) / r.height) * H;
      pointer.current = { x: (x / W) * 2 - 1, y: (y / H) * 2 - 1 };
      let best: string | null = null, bestD = 120;
      for (const { n, i } of indexed) {
        const p = nodePos(n, i);
        const d = Math.hypot(p.anchorX - (n.side === "eng" ? PILL_W / 2 : -PILL_W / 2) - x, p.anchorY - y);
        if (d < bestD) { bestD = d; best = n.id; }
      }
      setNear(best);
    },
    [indexed],
  );

  const sel = NODES.find((n) => n.id === selected) ?? null;
  const use3D = webgl === true && !reduced && wide;
  const [sceneReady, setSceneReady] = useState(false);
  useEffect(() => { if (!use3D) setSceneReady(false); }, [use3D]);
  const showPackets = !reduced;

  return (
    <div className="relative">
      <div
        ref={wrapRef}
        className="relative aspect-[760/600] w-full"
        onPointerMove={onMove}
        onPointerLeave={() => { setNear(null); pointer.current = { x: 0, y: 0 }; }}
      >
        {/* WebGL nucleus (desktop/tablet, motion allowed). Static SVG core otherwise. */}
        {use3D && (
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <CoreScene active={inView} pointer={pointer} onReady={() => setSceneReady(true)} />
          </div>
        )}

        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" role="group" aria-labelledby="hero-system-title hero-system-desc">
          <title id="hero-system-title">Engineering and data intelligence converging into one system</title>
          <desc id="hero-system-desc">
            Left: physical technology from industrial devices to software services. Right: business intelligence from enterprise records to business decisions. Both flows converge in a unified core. Select a node to read about that capability.
          </desc>
          <defs>
            <radialGradient id="coreGlow">
              <stop offset="0%" stopColor="#f3f7ff" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#f3f7ff" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="engFade" x1="0" x2="1">
              <stop offset="0%" stopColor="#0069f5" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#0069f5" stopOpacity="0.15" />
            </linearGradient>
            <linearGradient id="dataFade" x1="1" x2="0">
              <stop offset="0%" stopColor="#00d4ea" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#00d4ea" stopOpacity="0.15" />
            </linearGradient>
          </defs>

          {(!use3D || !sceneReady) && <StaticCore spin={!reduced} />}

          {/* Connection paths + packets */}
          {indexed.map(({ n, i }) => {
            const d = pathFor(n, i);
            const hot = near === n.id || selected === n.id;
            return (
              <g key={`p-${n.id}`} aria-hidden>
                <path id={`hp-${n.id}`} d={d} fill="none" stroke={n.side === "eng" ? "url(#engFade)" : "url(#dataFade)"} strokeWidth={hot ? 1.8 : 1} opacity={hot ? 1 : 0.55} />
                {hot && <path d={d} fill="none" stroke={n.side === "eng" ? "#77b5ff" : "#5ae7f2"} strokeWidth="1.2" className="flow-dash" />}
                {showPackets && (
                  <circle r={hot ? 3.2 : 2.2} fill={n.side === "eng" ? "#77b5ff" : "#5ae7f2"}>
                    <animateMotion dur={`${2.6 + (i % 3) * 0.7}s`} repeatCount="indefinite" begin={`${i * 0.37}s`}>
                      <mpath href={`#hp-${n.id}`} />
                    </animateMotion>
                  </circle>
                )}
              </g>
            );
          })}

          {/* Side captions */}
          <text x={14} y={44} className="fill-eng-ink font-mono" fontSize="11" letterSpacing="1.5">PHYSICAL TECHNOLOGY</text>
          <text x={W - 14} y={44} textAnchor="end" className="fill-data-ink font-mono" fontSize="11" letterSpacing="1.5">BUSINESS INTELLIGENCE</text>

          {/* Nodes */}
          {indexed.map(({ n, i }) => {
            const p = nodePos(n, i);
            const hot = near === n.id || selected === n.id;
            const stroke = n.side === "eng" ? "#0069f5" : "#00d4ea";
            return (
              <g
                key={n.id}
                role="button"
                tabIndex={0}
                aria-pressed={selected === n.id}
                aria-label={`${n.label}: show details`}
                className="cursor-pointer outline-none [&:focus-visible>rect]:stroke-white"
                onClick={() => setSelected((s) => (s === n.id ? null : n.id))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected((s) => (s === n.id ? null : n.id)); }
                }}
                onFocus={() => setNear(n.id)}
              >
                <rect x={p.x} y={p.y} width={PILL_W} height={PILL_H} rx={6} fill={hot ? (n.side === "eng" ? "#0a2247" : "#073040") : "#091326"} stroke={stroke} strokeOpacity={hot ? 1 : 0.45} strokeWidth={hot ? 1.5 : 1} style={{ transition: "all .3s cubic-bezier(.16,1,.3,1)" }} />
                <circle cx={n.side === "eng" ? p.x + 14 : p.x + PILL_W - 14} cy={p.anchorY} r={3} fill={stroke} />
                {hot && showPackets && <circle cx={n.side === "eng" ? p.x + 14 : p.x + PILL_W - 14} cy={p.anchorY} r={3} fill="none" stroke={stroke} className="pulse-ring" />}
                {wide && <text
                  x={n.side === "eng" ? p.x + 26 : p.x + PILL_W - 26}
                  y={p.anchorY + 4}
                  textAnchor={n.side === "eng" ? "start" : "end"}
                  fontSize={12}
                  className={cx("font-sans", hot ? "fill-ink" : "fill-mute")}
                >
                  {n.label}
                </text>}
              </g>
            );
          })}

          {/* Decorative technical labels — clearly not live status */}
          <g aria-hidden className="font-mono" fontSize="10" letterSpacing="1.2">
            <text x={CX} y={CY - CORE_R - 34} textAnchor="middle" className="fill-dim">SYSTEMS / INTEGRATED</text>
            <text x={CX} y={CY + CORE_R + 42} textAnchor="middle" className="fill-dim">DATA / VALIDATED</text>
            <text x={CX} y={CY + CORE_R + 58} textAnchor="middle" className="fill-dim" opacity="0.7">WORKFLOWS / CONNECTED</text>
          </g>
        </svg>
      </div>

      {/* Touch-friendly node list for small screens */}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:hidden">
        {(["eng", "data"] as const).map((side) => (
          <ul key={side} className="space-y-2" aria-label={side === "eng" ? "Physical technology" : "Business intelligence"}>
            {NODES.filter((n) => n.side === side).map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  aria-pressed={selected === n.id}
                  onClick={() => setSelected((s) => (s === n.id ? null : n.id))}
                  className={cx(
                    "flex min-h-11 w-full items-center gap-2 rounded-lg border px-3 text-left text-[0.82rem]",
                    side === "eng" ? "border-eng/35" : "border-data/35",
                    selected === n.id ? "bg-raised text-ink" : "bg-base text-mute",
                  )}
                >
                  <span aria-hidden className={cx("size-1.5 shrink-0 rounded-full", side === "eng" ? "bg-eng" : "bg-data")} />
                  {n.label}
                </button>
              </li>
            ))}
          </ul>
        ))}
      </div>

      {/* Detail panel */}
      <div aria-live="polite" className="min-h-[7.5rem]">
        {sel ? (
          <div key={sel.id} className={cx("rise-in relative mt-2 rounded-xl border bg-panel/90 p-5 pr-12 backdrop-blur", sel.side === "eng" ? "border-eng/40" : "border-data/40")}>
            <p className={cx("font-mono text-[0.7rem] uppercase tracking-[0.14em]", sel.side === "eng" ? "text-eng-ink" : "text-data-ink")}>
              {sel.side === "eng" ? "Engineering" : "Data intelligence"}
            </p>
            <p className="mt-1.5 font-display text-lg font-medium text-ink">{sel.label}</p>
            <p className="mt-1 text-sm leading-relaxed text-mute">{sel.text}</p>
            <Link href={sel.href} className="mt-3 inline-flex items-center gap-1.5 text-sm text-ink hover:underline">
              Related practice <ArrowRight className="size-3.5" aria-hidden />
            </Link>
            <button type="button" onClick={() => setSelected(null)} className="absolute right-3 top-3 inline-flex size-9 items-center justify-center rounded-full text-mute hover:bg-white/5 hover:text-ink" aria-label="Close details">
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <p className="mt-4 text-center font-mono text-xs text-dim">Select any node to see what it does — both sides meet in the same system.</p>
        )}
      </div>
    </div>
  );
}
