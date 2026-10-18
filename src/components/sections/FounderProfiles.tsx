"use client";

import Link from "next/link";
import { useRef } from "react";
import { ArrowUpRight } from "lucide-react";
import { founders, type Founder } from "@/data/founders";
import { caseStudies } from "@/data/projects";
import { useInView, useReducedMotion } from "@/lib/hooks";
import { cx } from "@/components/ui/primitives";

function EngMotif() {
  const nodes = [[20, 30], [70, 14], [120, 40], [60, 62], [160, 20], [180, 58], [110, 78]];
  const edges = [[0, 1], [1, 2], [0, 3], [3, 2], [2, 4], [4, 5], [2, 6], [5, 6]];
  return (
    <svg viewBox="0 0 200 92" className="h-full w-full" aria-hidden fill="none">
      {edges.map(([a, b], i) => <line key={i} x1={nodes[a][0]} y1={nodes[a][1]} x2={nodes[b][0]} y2={nodes[b][1]} stroke="#DA3633" strokeOpacity="0.45" className="flow-dash-slow" />)}
      {nodes.map(([x, y], i) => <rect key={i} x={x - 4} y={y - 4} width="8" height="8" rx="1.5" fill="#0D1117" stroke={i === 2 ? "#F3F6FA" : "#DA3633"} />)}
    </svg>
  );
}
function DataMotif() {
  return (
    <svg viewBox="0 0 200 92" className="h-full w-full" aria-hidden fill="none">
      {Array.from({ length: 5 }).map((_, r) => Array.from({ length: 8 }).map((_, c) => (
        <rect key={`${r}-${c}`} x={6 + c * 14} y={8 + r * 16} width="11" height="10" rx="1.5" fill="#00C8D7" fillOpacity={(r * 8 + c) % 7 === 0 ? 0.75 : 0.14} />
      )))}
      <path d="M126 80 L140 58 L154 66 L168 34 L182 42 L196 14" stroke="#3FDBE6" strokeWidth="1.5" />
      {[[126, 80], [140, 58], [154, 66], [168, 34], [182, 42], [196, 14]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.2" fill="#00C8D7" />)}
    </svg>
  );
}

function Profile({ f, compact }: { f: Founder; compact: boolean }) {
  const eng = f.discipline === "engineering";
  const projects = caseStudies.filter((c) => c.contributor.includes(f.id) && c.group !== "unified").slice(0, 4);
  return (
    <article className={cx("relative flex flex-col overflow-hidden rounded-3xl border bg-panel", eng ? "border-eng/30" : "border-data/30")} aria-labelledby={`f-${f.id}`}>
      <div className={cx("relative h-28 border-b px-6 pt-4", eng ? "border-eng/20 bg-eng-deep/40" : "border-data/20 bg-data-deep/40")}>
        {eng ? <EngMotif /> : <DataMotif />}
      </div>
      <div className="flex flex-1 flex-col p-6 sm:p-8">
        <div className="flex items-start gap-4">
          {f.headshot ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={f.headshot} alt={`Portrait of ${f.displayName}`} className="size-16 rounded-2xl object-cover" />
          ) : (
            <span aria-hidden className={cx("flex size-16 shrink-0 items-center justify-center rounded-2xl border font-display text-2xl", eng ? "border-eng/40 text-eng-ink" : "border-data/40 text-data-ink")}>
              {f.displayName.charAt(0)}
            </span>
          )}
          <div>
            <h3 id={`f-${f.id}`} className="font-display text-3xl tracking-[-0.02em] text-ink">{f.displayName}</h3>
            <p className={cx("mt-1 text-sm", eng ? "text-eng-ink" : "text-data-ink")}>{f.title}</p>
            <p className="mt-0.5 font-mono text-xs text-dim">{f.location}</p>
          </div>
        </div>

        <div className="mt-6 space-y-3 leading-relaxed text-mute">
          {(compact ? f.bio.slice(0, 1) : f.bio).map((p) => <p key={p.slice(0, 20)}>{p}</p>)}
        </div>

          <p className="mt-6 font-mono text-[0.65rem] uppercase tracking-[0.1em] text-dim">Working philosophy · proposed profile wording</p>
          <p className={cx("mt-2 border-l pl-4 font-display text-lg leading-snug text-ink", eng ? "border-eng" : "border-data")}>
            {f.philosophy}
          </p>

        {!compact && (
          <>
            <h4 className="mt-8 font-mono text-xs uppercase tracking-[0.12em] text-dim">Core competencies</h4>
            <dl className="mt-3 grid gap-x-6 gap-y-4 sm:grid-cols-2">
              {f.competencies.map((g) => (
                <div key={g.group}>
                  <dt className="text-sm text-ink">{g.group}</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-mute">{g.items.join(" · ")}</dd>
                </div>
              ))}
            </dl>
            {f.developing && (
              <>
                <h4 className="mt-8 font-mono text-xs uppercase tracking-[0.12em] text-dim">Currently developing</h4>
                <p className="mt-2 text-sm text-mute">{f.developing.join(" · ")}</p>
                <p className="mt-1 text-xs text-dim">Listed as growth areas, not established production specialisations.</p>
              </>
            )}
            {projects.length > 0 && (
              <>
                <h4 className="mt-8 font-mono text-xs uppercase tracking-[0.12em] text-dim">Selected work</h4>
                <ul className="mt-2 divide-y divide-line">
                  {projects.map((p) => (
                    <li key={p.slug}>
                      <Link href={`/work/${p.slug}`} className="group flex items-center justify-between gap-3 py-2.5 text-sm text-mute hover:text-ink">
                        {p.title}
                        <ArrowUpRight className="size-4 shrink-0 opacity-50 group-hover:opacity-100" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}

        <div className="mt-auto pt-8">
          <h4 className="font-mono text-xs uppercase tracking-[0.12em] text-dim">Responsible for</h4>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {f.responsibilities.map((r) => (
              <li key={r} className={cx("rounded-md border px-2 py-1 text-xs", eng ? "border-eng/30 text-mute" : "border-data/30 text-mute")}>{r}</li>
            ))}
          </ul>
          {f.links.length > 0 && (
            <ul className="mt-5 flex flex-wrap gap-4 text-sm">
              {f.links.map((l) => (
                <li key={l.href}><a href={l.href} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-ink hover:underline">{l.label}<ArrowUpRight className="size-3.5" aria-hidden /></a></li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </article>
  );
}

/** Two equal profiles joined by an animated flow into a shared architecture. */
export function FounderProfiles({ compact = false }: { compact?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, "-15% 0px");
  const reduced = useReducedMotion();
  const live = inView && !reduced;

  return (
    <div ref={ref} className="relative grid items-stretch gap-6 lg:grid-cols-[1fr_7rem_1fr] lg:gap-0">
      <Profile f={founders[0]} compact={compact} />

      {/* Connector */}
      <div aria-hidden className="relative hidden lg:block">
        <svg viewBox="0 0 112 600" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" fill="none">
          <defs>
            <linearGradient id="fpG" x1="0" x2="1"><stop offset="0" stopColor="#DA3633" /><stop offset="1" stopColor="#00C8D7" /></linearGradient>
          </defs>
          {[160, 300, 440].map((y, i) => (
            <g key={y}>
              <path id={`fp-${i}`} d={`M0 ${y} C 40 ${y}, 40 300, 56 300 S 72 ${y}, 112 ${y}`} stroke="url(#fpG)" strokeOpacity={inView ? 0.7 : 0.15} style={{ transition: "stroke-opacity 1.2s" }} vectorEffect="non-scaling-stroke" />
              {live && (
                <circle r="2.5" fill="#F3F6FA">
                  <animateMotion dur="3.2s" begin={`${i * 0.6}s`} repeatCount="indefinite"><mpath href={`#fp-${i}`} /></animateMotion>
                </circle>
              )}
            </g>
          ))}
        </svg>
        <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
          <span className={cx("relative flex size-12 items-center justify-center rounded-full border border-ink/40 bg-void transition-shadow duration-1000", inView && "shadow-[0_0_40px_-4px_rgba(0,200,215,0.45)]")}>
            <span className="size-3 rounded-full bg-ink" />
          </span>
          <span className="mt-3 w-24 text-center font-mono text-[0.6rem] uppercase leading-tight tracking-[0.12em] text-mute">Shared architecture</span>
        </div>
      </div>
      <div aria-hidden className="flex items-center justify-center gap-3 lg:hidden">
        <span className="h-px flex-1 bg-gradient-to-r from-transparent to-eng" />
        <span className="font-mono text-[0.65rem] uppercase tracking-[0.12em] text-mute">Shared architecture</span>
        <span className="h-px flex-1 bg-gradient-to-r from-data to-transparent" />
      </div>

      <Profile f={founders[1]} compact={compact} />
    </div>
  );
}
