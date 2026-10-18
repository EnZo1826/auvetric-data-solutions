"use client";

import { useEffect, useRef, useState } from "react";
import {
  Activity, AlertTriangle, BarChart3, Bell, Building2, CheckCircle2, Cpu, Database, FileSpreadsheet, GitMerge, Network,
  Pause, Play, Radio, RotateCcw, ScanSearch, Server, ShieldCheck, SkipForward, Truck, UserCheck, Workflow, Zap,
} from "lucide-react";
import { architectures, type Architecture } from "@/data/architectures";
import { useInView, useReducedMotion } from "@/lib/hooks";
import { cx, SyntheticTag } from "@/components/ui/primitives";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  sensor: Activity, plc: Cpu, edge: Server, mqtt: Radio, api: ShieldCheck, db: Database, analytics: BarChart3, decision: UserCheck,
  supplier: Truck, dc: Building2, erp: FileSpreadsheet, profiling: ScanSearch, validation: ShieldCheck, reconciliation: GitMerge, powerbi: BarChart3, mgmt: UserCheck,
  event: Zap, integration: Network, validate: ShieldCheck, rules: Workflow, approval: UserCheck, store: Database, reporting: BarChart3, notify: Bell,
};

const KIND = {
  eng: { stroke: "#0069f5", ink: "#77b5ff", fill: "#0a2247", text: "text-eng-ink" },
  data: { stroke: "#00d4ea", ink: "#5ae7f2", fill: "#073040", text: "text-data-ink" },
  core: { stroke: "#f3f7ff", ink: "#f3f7ff", fill: "#172b46", text: "text-ink" },
} as const;

// SVG geometry (desktop)
const VW = 1040, VH = 210, PADX = 70, NY = 92, NR = 30;
const nx = (i: number, n: number) => PADX + (i * (VW - PADX * 2)) / (n - 1);

export function ArchitectureLab() {
  const [archId, setArchId] = useState<Architecture["id"]>("industrial");
  const arch = architectures.find((a) => a.id === archId)!;
  const [sel, setSel] = useState(0);
  const [lens, setLens] = useState<"business" | "technical">("business");
  const [playing, setPlaying] = useState(false);
  const [fault, setFault] = useState(false);
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, "-20% 0px");
  const userTouched = useRef(false);

  // Auto-follow the data once when the lab first enters the viewport (not under reduced motion)
  useEffect(() => {
    if (inView && !reduced && !userTouched.current) setPlaying(true);
    if (!inView) setPlaying(false);
  }, [inView, reduced]);

  useEffect(() => {
    if (!playing || fault) return;
    const id = window.setInterval(() => setSel((s) => (s + 1) % arch.nodes.length), 2400);
    return () => window.clearInterval(id);
  }, [playing, fault, arch.nodes.length]);

  const choose = (i: number) => {
    userTouched.current = true;
    setPlaying(false);
    setFault(false);
    setSel(i);
  };
  const switchArch = (id: Architecture["id"]) => {
    userTouched.current = true;
    setArchId(id);
    setSel(0);
    setFault(false);
    setPlaying(false);
  };

  const node = arch.nodes[sel];
  const n = arch.nodes.length;
  const k = KIND[node.kind];
  const trackD = `M ${nx(0, n)} ${NY} ${arch.nodes.slice(1).map((_, i) => `L ${nx(i + 1, n)} ${NY}`).join(" ")}`;

  return (
    <div ref={ref} className="overflow-hidden rounded-3xl border border-line bg-base">
      {/* Toolbar */}
      <div className="flex flex-col gap-4 border-b border-line p-4 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div role="tablist" aria-label="Architecture" className="flex flex-wrap gap-2">
          {architectures.map((a, i) => (
            <button
              key={a.id}
              role="tab"
              aria-selected={a.id === archId}
              aria-controls="lab-panel"
              onClick={() => switchArch(a.id)}
              className={cx(
                "min-h-11 rounded-xl border px-4 text-left text-sm transition-colors",
                a.id === archId ? "border-ink/30 bg-raised text-ink" : "border-line text-mute hover:text-ink",
              )}
            >
              <span className="mr-2 font-mono text-xs text-dim">{String.fromCharCode(65 + i)}</span>
              {a.name}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="radiogroup" aria-label="Explanation" className="inline-flex rounded-xl border border-line p-1">
            {(["business", "technical"] as const).map((l) => (
              <button key={l} role="radio" aria-checked={lens === l} onClick={() => setLens(l)} className={cx("min-h-9 rounded-lg px-3 text-xs capitalize", lens === l ? "bg-raised text-ink" : "text-mute hover:text-ink")}>
                {l}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => { userTouched.current = true; setFault(false); setPlaying((p) => !p); }}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-3 text-xs text-ink hover:border-mute"
            aria-pressed={playing}
          >
            {playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
            {playing ? "Pause" : "Follow the data"}
          </button>
          <button type="button" onClick={() => choose((sel + 1) % n)} className="inline-flex size-11 items-center justify-center rounded-xl border border-line text-ink hover:border-mute" aria-label="Next node">
            <SkipForward className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      <div id="lab-panel" role="tabpanel" className="relative">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-5 sm:px-6">
          <p className="text-sm text-mute">
            <span className="font-display text-base text-ink">{arch.tagline}</span>
            <span className="ml-2 text-dim">· {arch.lead}</span>
          </p>
          <SyntheticTag>Simulation · not connected to live systems</SyntheticTag>
        </div>

        {/* Desktop topology */}
        <div className="relative hidden px-2 lg:block">
          <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full" role="group" aria-label={`${arch.name} data flow`}>
            <defs>
              <linearGradient id="labTrack" x1="0" x2="1">
                <stop offset="0" stopColor="#0069f5" />
                <stop offset="0.5" stopColor="#f3f7ff" stopOpacity="0.6" />
                <stop offset="1" stopColor="#00d4ea" />
              </linearGradient>
            </defs>
            <path d={trackD} stroke="url(#labTrack)" strokeOpacity="0.35" strokeWidth="1.5" fill="none" />
            <path id="lab-track" d={trackD} stroke="#f3f7ff" strokeOpacity="0.35" fill="none" className="flow-dash-slow" />
            {/* progress up to selected node */}
            <path d={`M ${nx(0, n)} ${NY} L ${nx(sel, n)} ${NY}`} stroke="url(#labTrack)" strokeWidth="2.5" fill="none" style={{ transition: "d .6s cubic-bezier(.16,1,.3,1)" }} />
            {!reduced && !fault && (
              <g aria-hidden>
                {[0, 1, 2].map((p) => (
                  <circle key={`${archId}-${p}`} r="3" fill="#f3f7ff">
                    <animateMotion dur="6s" begin={`${p * 2}s`} repeatCount="indefinite">
                      <mpath href="#lab-track" />
                    </animateMotion>
                  </circle>
                ))}
              </g>
            )}
            {arch.nodes.map((nd, i) => {
              const x = nx(i, n);
              const kk = KIND[nd.kind];
              const on = i === sel;
              const broken = on && fault;
              const Icon = ICONS[nd.id] ?? Activity;
              return (
                <g
                  key={nd.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={on}
                  aria-label={`${i + 1}. ${nd.label}`}
                  onClick={() => choose(i)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(i); } }}
                  className="cursor-pointer outline-none [&:focus-visible_.ring]:opacity-100"
                >
                  <circle className="ring" cx={x} cy={NY} r={NR + 8} fill="none" stroke="#00d4ea" strokeWidth="2" opacity="0" />
                  {on && !reduced && <circle cx={x} cy={NY} r={NR} fill="none" stroke={broken ? "#F0B35A" : kk.stroke} className="pulse-ring" />}
                  <circle cx={x} cy={NY} r={NR} fill={on ? (broken ? "#2b2010" : kk.fill) : "#091326"} stroke={broken ? "#F0B35A" : kk.stroke} strokeOpacity={on ? 1 : 0.5} strokeWidth={on ? 2 : 1.2} style={{ transition: "all .4s" }} />
                  <Icon className={cx("pointer-events-none", broken ? "text-warn" : on ? "text-ink" : "text-mute")} {...({ x: x - 11, y: NY - 11, width: 22, height: 22 } as object)} />
                  <text x={x} y={NY + NR + 24} textAnchor="middle" fontSize="13" className={cx("font-sans", on ? "fill-ink" : "fill-mute")}>{nd.label}</text>
                  <text x={x} y={NY - NR - 14} textAnchor="middle" fontSize="10" className="fill-dim font-mono">{String(i + 1).padStart(2, "0")}</text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Mobile / tablet stepper */}
        <ol className="grid grid-cols-2 gap-2 px-4 pt-5 sm:grid-cols-4 sm:px-6 lg:hidden" aria-label={`${arch.name} data flow`}>
          {arch.nodes.map((nd, i) => {
            const Icon = ICONS[nd.id] ?? Activity;
            const on = i === sel;
            return (
              <li key={nd.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => choose(i)}
                  className={cx("flex min-h-12 w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-sm", on ? "border-ink/40 bg-raised text-ink" : "border-line text-mute")}
                >
                  <span className="font-mono text-[0.65rem] text-dim">{String(i + 1).padStart(2, "0")}</span>
                  <Icon className={cx("size-4 shrink-0", KIND[nd.kind].text)} aria-hidden />
                  <span className="leading-tight">{nd.label}</span>
                </button>
              </li>
            );
          })}
        </ol>

        {/* Inspector */}
        <div key={`${archId}-${sel}-${lens}`} className="rise-in grid gap-px border-t border-line bg-line lg:mt-2 lg:grid-cols-12" aria-live="polite">
          <div className="bg-base p-5 sm:p-6 lg:col-span-5">
            <p className={cx("font-mono text-xs uppercase tracking-[0.12em]", k.text)}>
              Node {String(sel + 1).padStart(2, "0")} · {node.kind === "eng" ? "Engineering" : node.kind === "data" ? "Data intelligence" : "Integration core"}
            </p>
            <h3 className="mt-2 font-display text-2xl font-medium tracking-[-0.02em] text-ink">{node.label}</h3>
            <p className="mt-3 leading-relaxed text-mute">{lens === "business" ? node.business : node.technical}</p>
            <ul className="mt-5 flex flex-wrap gap-1.5" aria-label="Technologies involved">
              {node.tech.map((t) => <li key={t} className="rounded-md border border-line-strong px-2 py-1 font-mono text-[0.7rem] text-mute">{t}</li>)}
            </ul>
          </div>
          <div className="bg-base p-5 sm:p-6 lg:col-span-4">
            <p className="font-mono text-xs uppercase tracking-[0.12em] text-dim">Sample data · in → out</p>
            <dl className="mt-3 space-y-3">
              <div>
                <dt className="text-xs text-dim">Input</dt>
                <dd className="mt-1 rounded-lg border border-line bg-void px-3 py-2 font-mono text-[0.76rem] leading-relaxed text-mute break-words">{node.input}</dd>
              </div>
              <div>
                <dt className="text-xs text-dim">Output</dt>
                <dd className={cx("mt-1 rounded-lg border px-3 py-2 font-mono text-[0.76rem] leading-relaxed break-words", fault ? "border-warn/40 bg-warn/[0.06] text-warn" : "border-ok/30 bg-ok/[0.05] text-ok")}>
                  {fault ? `FAILURE — ${node.failure}` : node.output}
                </dd>
              </div>
            </dl>
          </div>
          <div className="bg-base p-5 sm:p-6 lg:col-span-3">
            <p className="font-mono text-xs uppercase tracking-[0.12em] text-dim">Failure & recovery</p>
            <div className="mt-3 space-y-3 text-sm">
              <p className="flex gap-2.5 text-mute"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />{node.failure}</p>
              <p className={cx("flex gap-2.5 transition-colors", fault ? "text-ink" : "text-mute")}><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden />{node.recovery}</p>
            </div>
            <button
              type="button"
              onClick={() => { userTouched.current = true; setPlaying(false); setFault((f) => !f); }}
              aria-pressed={fault}
              className={cx("mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-xs", fault ? "border-warn/50 text-warn" : "border-line text-ink hover:border-mute")}
            >
              {fault ? <RotateCcw className="size-4" aria-hidden /> : <AlertTriangle className="size-4" aria-hidden />}
              {fault ? "Clear simulated failure" : "Simulate failure here"}
            </button>
          </div>
        </div>
      </div>

      <div className="border-t border-line px-4 py-4 sm:px-6">
        <p className="text-xs text-dim">
          Illustrates: {arch.illustrates.join(" · ")}
        </p>
      </div>
    </div>
  );
}
