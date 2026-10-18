"use client";

import { useState } from "react";
import { methodology } from "@/data/methodology";
import { cx } from "@/components/ui/primitives";

const leadLabel = { jakes: "Engineering-led", alex: "Data-led", both: "Joint" } as const;
const leadDot = { jakes: "bg-eng", alex: "bg-data", both: "bg-gradient-to-r from-eng to-data" } as const;

export function MethodologyTimeline({ compact = false }: { compact?: boolean }) {
  const [i, setI] = useState(0);
  const s = methodology[i];
  const pct = (i / (methodology.length - 1)) * 100;

  return (
    <div>
      <div className="relative">
        <div aria-hidden className="absolute left-0 right-0 top-[1.15rem] hidden h-px bg-line md:block" />
        <div aria-hidden className="absolute left-0 top-[1.15rem] hidden h-px bg-gradient-to-r from-eng to-data transition-[width] duration-700 ease-[var(--ease-out-expo)] md:block" style={{ width: `${pct}%` }} />
        <ol className="relative grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-7 md:gap-0" aria-label="Delivery methodology">
          {methodology.map((m, idx) => {
            const on = idx === i, done = idx < i;
            return (
              <li key={m.id} className="md:text-center">
                <button
                  type="button"
                  aria-current={on ? "step" : undefined}
                  aria-controls="method-detail"
                  onClick={() => setI(idx)}
                  onMouseEnter={() => setI(idx)}
                  onFocus={() => setI(idx)}
                  className="group flex w-full items-center gap-3 rounded-lg p-1 text-left md:flex-col md:gap-3 md:text-center"
                >
                  <span className={cx(
                    "relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full border font-mono text-xs transition-all duration-500",
                    on ? "border-ink bg-ink text-void" : done ? "border-mute bg-raised text-ink" : "border-line-strong bg-base text-dim group-hover:text-ink",
                  )}>
                    {m.n}
                  </span>
                  <span className={cx("font-display text-[0.95rem]", on ? "text-ink" : "text-mute group-hover:text-ink")}>{m.name}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <div id="method-detail" aria-live="polite" className={cx("mt-10 grid gap-8 rounded-2xl border border-line bg-panel p-6 sm:p-8", !compact && "md:grid-cols-[1.3fr_1fr]")}>
        <div key={s.id} className="rise-in">
          <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.12em] text-dim">
            <span aria-hidden className={cx("size-2 rounded-full", leadDot[s.lead])} />
            Stage {s.n} · {leadLabel[s.lead]}
          </p>
          <h3 className="mt-3 font-display text-3xl tracking-[-0.02em] text-ink">{s.name}</h3>
          <p className="mt-3 max-w-[60ch] leading-relaxed text-mute">{s.text}</p>
        </div>
        {!compact && (
          <div key={`${s.id}-o`} className="rise-in">
            <p className="font-mono text-xs uppercase tracking-[0.12em] text-dim">Typical outputs</p>
            <ul className="mt-3 space-y-2">
              {s.outputs.map((o) => (
                <li key={o} className="flex items-center gap-3 border-b border-line pb-2 text-sm text-ink">
                  <span aria-hidden className="size-1 rounded-full bg-ok" /> {o}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
