"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { industries } from "@/data/industries";
import { practiceBySlug } from "@/data/practices";
import { caseStudyBySlug } from "@/data/projects";
import { cx } from "@/components/ui/primitives";

function Motif({ kind }: { kind: string }) {
  // Small schematic per sector; decorative.
  const common = { fill: "none", strokeWidth: 1.2 } as const;
  return (
    <svg viewBox="0 0 220 90" className="h-full w-full" aria-hidden>
      <g stroke="#9dafc8" strokeOpacity="0.1">{Array.from({ length: 12 }).map((_, i) => <line key={i} x1={i * 20} x2={i * 20} y1="0" y2="90" />)}</g>
      {kind === "retail" && (
        <g {...common}>
          {[20, 70, 120].map((x, i) => <rect key={x} x={x} y="20" width="34" height="26" rx="3" stroke="#00d4ea" strokeOpacity={0.4 + i * 0.2} />)}
          <path d="M37 46 V66 H187 M87 46 V66 M137 46 V66" stroke="#00d4ea" className="flow-dash" />
          <rect x="172" y="56" width="30" height="20" rx="3" stroke="#f3f7ff" />
        </g>
      )}
      {kind === "industrial" && (
        <g {...common}>
          <circle cx="40" cy="45" r="20" stroke="#0069f5" />
          <path d="M40 25 V45 L54 52" stroke="#77b5ff" className="spin-slow" />
          <path d="M60 45 H120 V25 H180" stroke="#0069f5" className="flow-dash" />
          <rect x="180" y="15" width="24" height="20" rx="3" stroke="#f3f7ff" />
          <path d="M120 45 V65 H180" stroke="#00d4ea" strokeOpacity="0.6" />
        </g>
      )}
      {kind === "fleet" && (
        <g {...common}>
          <path id="ind-route" d="M10 70 C 50 10, 90 80, 130 30 S 190 40, 210 20" stroke="#0069f5" strokeOpacity="0.6" strokeDasharray="3 4" />
          <circle r="4" fill="#f3f7ff"><animateMotion dur="6s" repeatCount="indefinite"><mpath href="#ind-route" /></animateMotion></circle>
          {[[60, 40], [130, 30], [190, 28]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="10" stroke="#00d4ea" strokeOpacity="0.4" />)}
        </g>
      )}
      {kind === "security" && (
        <g {...common}>
          <rect x="20" y="25" width="60" height="40" rx="4" stroke="#0069f5" />
          <path d="M80 45 H130" stroke="#f3f7ff" className="flow-dash" />
          <path d="M130 30 L150 20 V70 L130 60 Z" stroke="#00d4ea" />
          <circle cx="185" cy="45" r="16" stroke="#00d4ea" strokeOpacity="0.5" />
          <circle cx="185" cy="45" r="5" fill="#00d4ea" className="blink-soft" />
        </g>
      )}
      {kind === "sme" && (
        <g {...common}>
          {[0, 1, 2, 3].map((i) => <rect key={i} x={20 + i * 48} y={30} width="34" height="30" rx="4" stroke={i % 2 ? "#00d4ea" : "#0069f5"} strokeOpacity="0.7" />)}
          <path d="M54 45 H68 M102 45 H116 M150 45 H164" stroke="#f3f7ff" className="flow-dash" />
        </g>
      )}
      {kind === "agri" && (
        <g {...common}>
          <path d="M0 70 Q 55 50 110 70 T 220 70" stroke="#49D7B1" strokeOpacity="0.5" />
          <path d="M60 60 V25 M50 25 H70" stroke="#0069f5" />
          <circle cx="60" cy="25" r="10" stroke="#0069f5" className="pulse-ring" />
          <path d="M70 30 Q 120 0 170 30" stroke="#00d4ea" strokeDasharray="2 5" className="flow-dash" />
          <rect x="165" y="30" width="30" height="20" rx="3" stroke="#f3f7ff" />
        </g>
      )}
    </svg>
  );
}

export function IndustryExplorer() {
  const [active, setActive] = useState(industries[0].slug);
  const ind = industries.find((i) => i.slug === active)!;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
      <div role="tablist" aria-label="Industries" aria-orientation="vertical" className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
        {industries.map((i) => (
          <button
            key={i.slug}
            role="tab"
            id={`ind-${i.slug}`}
            aria-selected={i.slug === active}
            aria-controls="ind-panel"
            onClick={() => setActive(i.slug)}
            className={cx(
              "flex min-h-12 shrink-0 items-center justify-between gap-4 rounded-xl border px-4 text-left text-sm transition-colors",
              i.slug === active ? "border-ink/30 bg-raised text-ink" : "border-line text-mute hover:text-ink",
            )}
          >
            <span>{i.name}</span>
            <span className={cx("hidden font-mono text-[0.6rem] uppercase tracking-[0.08em] sm:inline", i.experience === "direct" ? "text-ok" : "text-dim")}>
              {i.experience === "direct" ? "Direct experience" : "Applicable"}
            </span>
          </button>
        ))}
      </div>

      <div id="ind-panel" role="tabpanel" aria-labelledby={`ind-${ind.slug}`} key={ind.slug} className="rise-in overflow-hidden rounded-2xl border border-line bg-panel">
        <div className="relative h-32 border-b border-line bg-base p-4"><Motif kind={ind.motif} /></div>
        <div className="grid gap-8 p-6 sm:p-8 md:grid-cols-2">
          <div>
            <p className={cx("font-mono text-xs uppercase tracking-[0.12em]", ind.experience === "direct" ? "text-ok" : "text-warn")}>
              {ind.experience === "direct" ? "Confirmed partner experience" : "Potential application of our capabilities"}
            </p>
            <h3 className="mt-3 font-display text-lg text-ink">The commercial challenge</h3>
            <p className="mt-2 leading-relaxed text-mute">{ind.challenge}</p>
            <h3 className="mt-6 font-display text-lg text-ink">How we would approach it</h3>
            <p className="mt-2 leading-relaxed text-mute">{ind.approach}</p>
          </div>
          <div>
            <h3 className="font-mono text-xs uppercase tracking-[0.12em] text-dim">Focus areas</h3>
            <ul className="mt-3 flex flex-wrap gap-1.5">{ind.focus.map((f) => <li key={f} className="rounded-md border border-line-strong px-2 py-1 text-xs text-mute">{f}</li>)}</ul>
            <h3 className="mt-6 font-mono text-xs uppercase tracking-[0.12em] text-dim">Relevant practices</h3>
            <ul className="mt-2 space-y-1.5 text-sm">
              {ind.practices.map((s) => { const p = practiceBySlug(s)!; return <li key={s}><Link href={`/solutions/${s}`} className="text-ink hover:underline">{p.index} — {p.name}</Link></li>; })}
            </ul>
            <h3 className="mt-6 font-mono text-xs uppercase tracking-[0.12em] text-dim">Related work</h3>
            <ul className="mt-2 space-y-1.5 text-sm">
              {ind.projects.map((s) => { const c = caseStudyBySlug(s)!; return <li key={s}><Link href={`/work/${s}`} className="inline-flex items-center gap-1.5 text-mute hover:text-ink">{c.title}<ArrowRight className="size-3.5" aria-hidden /></Link></li>; })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
