"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Briefcase, Cpu } from "lucide-react";
import { practices } from "@/data/practices";
import { PracticeArt } from "@/components/illustrations/PracticeArt";
import { cx } from "@/components/ui/primitives";

type Lens = "business" | "technical";

const accentText = { eng: "text-eng-ink", data: "text-data-ink", converge: "text-ink" } as const;
const accentBar = { eng: "bg-eng", data: "bg-data", converge: "bg-gradient-to-b from-eng to-data" } as const;

export function PracticeExplorer() {
  const [lens, setLens] = useState<Lens>("business");
  const [active, setActive] = useState(practices[0].slug);
  const p = practices.find((x) => x.slug === active)!;

  return (
    <div>
      {/* Capability-based navigation: two perspectives, same validated content */}
      <div role="radiogroup" aria-label="Choose your perspective" className="inline-flex flex-wrap gap-2 rounded-2xl border border-line bg-base p-1.5">
        {([
          ["business", "I need a business solution", Briefcase],
          ["technical", "I want to explore the technology", Cpu],
        ] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            role="radio"
            aria-checked={lens === id}
            onClick={() => setLens(id)}
            className={cx(
              "inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm transition-colors",
              lens === id ? "bg-raised text-ink" : "text-mute hover:text-ink",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14">
        <ul className="divide-y divide-line border-y border-line" role="tablist" aria-label="Practices" aria-orientation="vertical">
          {practices.map((x) => {
            const on = x.slug === active;
            return (
              <li key={x.slug} className="relative">
                {on && <span aria-hidden className={cx("absolute inset-y-0 left-0 w-px", accentBar[x.accent])} />}
                <button
                  role="tab"
                  id={`tab-${x.slug}`}
                  aria-selected={on}
                  aria-controls="practice-panel"
                  onClick={() => setActive(x.slug)}
                  onMouseEnter={() => setActive(x.slug)}
                  className="group flex w-full items-baseline gap-5 py-6 pl-5 text-left"
                >
                  <span className={cx("font-mono text-xs", on ? accentText[x.accent] : "text-dim")}>{x.index}</span>
                  <span className="flex-1">
                    <span className={cx("block font-display text-[1.45rem] leading-tight tracking-[-0.02em] transition-colors sm:text-[1.7rem]", on ? "text-ink" : "text-mute group-hover:text-ink")}>
                      {x.name}
                    </span>
                    <span className={cx("mt-2 block text-sm leading-relaxed text-dim lg:hidden", on && "text-mute")}>{x.short}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <div id="practice-panel" role="tabpanel" aria-labelledby={`tab-${p.slug}`} className="relative overflow-hidden rounded-2xl border border-line bg-panel">
          <div className="relative h-48 border-b border-line bg-base sm:h-56">
            <div className="absolute inset-0 bg-grid opacity-60" />
            <div key={p.slug} className="rise-in absolute inset-4">
              <PracticeArt slug={p.slug} />
            </div>
          </div>
          <div key={`${p.slug}-${lens}`} className="rise-in p-6 sm:p-8">
            <p className="text-lg leading-relaxed text-ink">{lens === "business" ? p.businessLens : p.technicalLens}</p>
            {lens === "business" ? (
              <>
                <p className="mt-6 font-display text-base font-medium text-ink">{p.problem.headline}</p>
                <ul className="mt-3 grid gap-2 text-sm text-mute sm:grid-cols-2">
                  {p.problem.points.map((pt) => (
                    <li key={pt} className="flex gap-2.5"><span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-warn" />{pt}</li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <p className="mt-6 font-mono text-xs uppercase tracking-[0.12em] text-dim">Capability areas</p>
                <ul className="mt-3 space-y-1.5 text-sm text-mute">
                  {p.areas.map((a) => <li key={a.name}>{a.name}</li>)}
                </ul>
                <ul className="mt-5 flex flex-wrap gap-1.5" aria-label="Technologies">
                  {p.technologies.map((t) => (
                    <li key={t} className="rounded-md border border-line-strong px-2 py-1 font-mono text-[0.7rem] text-mute">{t}</li>
                  ))}
                </ul>
              </>
            )}
            <Link href={`/solutions/${p.slug}`} className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-ink hover:underline">
              Explore {p.name} <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
