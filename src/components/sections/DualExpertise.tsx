"use client";

import { useState } from "react";
import { cx } from "@/components/ui/primitives";

type View = "data" | "eng" | "unified";

const PAIRS = [
  { eng: "Flow meter & PLC", engD: "Pulse acquisition and calibration at the dispenser.", data: "Define the measure", dataD: "What exactly counts as one dispense, and in which unit?", link: "Measurement definition" },
  { eng: "Edge buffer", engD: "Store-and-forward so no dispense is lost offline.", data: "Source authority", dataD: "Which record wins when meter, ERP and invoice disagree?", link: "Source of truth" },
  { eng: "MQTT transport", engD: "Secure, at-least-once delivery from site to server.", data: "Validation rules", dataD: "Vehicle exists, volume ≤ tank capacity, no duplicate IDs.", link: "Rules at ingest" },
  { eng: "API & database", engD: "Idempotent ingest, history and audit tables.", data: "Reconciliation", dataD: "Dispensed litres vs ERP issues vs supplier deliveries.", link: "Matched records" },
  { eng: "Dashboard & alerts", engD: "Live levels, alarms and data-age indicators.", data: "KPI model", dataD: "Litres per km, variance %, exceptions by site.", link: "Trusted KPIs" },
  { eng: "Deploy & monitor", engD: "Docker services, TLS, health checks, backups.", data: "Governance", dataD: "Owners, review cadence and exception workflow.", link: "Accountability" },
];

const VIEWS: { id: View; label: string; who: string; summary: string; items: string[] }[] = [
  {
    id: "data",
    label: "Business Intelligence View",
    who: "Alex — Data, BI & process",
    summary: "Starts from the business question: are we paying for fuel we cannot account for? Defines what must be measured, which source is authoritative, the rules that make a record valid and the KPIs management will act on.",
    items: ["Understand the operational challenge", "Assess source systems", "Define validation rules", "Identify commercial exposure", "Design management reporting", "Define governance"],
  },
  {
    id: "eng",
    label: "Engineering View",
    who: "Jakes9NA — Systems engineering",
    summary: "Builds the system that captures every dispense at the pump, survives connectivity loss, delivers it reliably and stores it with a full history ready for reconciliation.",
    items: ["Design technical architecture", "Integrate physical devices", "Implement databases and APIs", "Build automation services", "Deploy infrastructure", "Monitor and synchronise"],
  },
  {
    id: "unified",
    label: "Unified Solution",
    who: "Both partners, one design",
    summary: "Each engineering component exists because a business rule needs it, and each rule is enforced somewhere real. The result: every litre measured, matched to a vehicle and a transaction, with variances raised to an accountable owner.",
    items: ["Rules are enforced at ingest, not discovered at month-end", "Reports carry their own data quality", "Exceptions have owners", "Engineering decisions trace to business value"],
  },
];

export function DualExpertise() {
  const [view, setView] = useState<View>("unified");
  const v = VIEWS.find((x) => x.id === view)!;
  const engOn = view !== "data";
  const dataOn = view !== "eng";
  const linked = view === "unified";

  return (
    <div>
      <div role="tablist" aria-label="Viewpoint" className="grid gap-2 sm:inline-grid sm:grid-cols-3">
        {VIEWS.map((x) => (
          <button
            key={x.id}
            role="tab"
            id={`dx-${x.id}`}
            aria-selected={view === x.id}
            aria-controls="dx-panel"
            onClick={() => setView(x.id)}
            className={cx(
              "min-h-11 rounded-xl border px-4 py-2.5 text-left text-sm transition-colors sm:text-center",
              view === x.id
                ? x.id === "data" ? "border-data/60 bg-data/10 text-ink" : x.id === "eng" ? "border-eng/60 bg-eng/10 text-ink" : "border-ink/40 bg-white/[0.05] text-ink"
                : "border-line text-mute hover:text-ink",
            )}
          >
            {x.label}
          </button>
        ))}
      </div>

      <p className="mt-6 font-mono text-xs uppercase tracking-[0.12em] text-dim">
        Example scenario: a fleet operator suspects fuel losses across remote sites
      </p>

      <div id="dx-panel" role="tabpanel" aria-labelledby={`dx-${view}`} className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
        {/* Diagram */}
        <div className="relative rounded-2xl border border-line bg-base p-4 sm:p-6">
          <div className="absolute inset-0 rounded-2xl bg-grid opacity-50" aria-hidden />
          <ol className="relative grid gap-3 md:grid-cols-6 md:gap-2">
            {PAIRS.map((p, i) => (
              <li key={p.eng} className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2 md:grid-cols-1 md:grid-rows-[1fr_auto_1fr]">
                <div className={cx("rounded-lg border p-3 transition-all duration-500", engOn ? "border-eng/50 bg-eng-deep/70 opacity-100" : "border-line bg-panel/60 opacity-35")}>
                  <p className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-eng-ink">ENG · {String(i + 1).padStart(2, "0")}</p>
                  <p className="mt-1 text-[0.82rem] font-medium leading-snug text-ink">{p.eng}</p>
                  <p className={cx("mt-1 text-[0.72rem] leading-snug text-mute", !engOn && "sr-only")}>{p.engD}</p>
                </div>
                <div aria-hidden className="relative flex items-center justify-center md:h-10">
                  <span className={cx("block h-px w-6 transition-all duration-500 md:h-full md:w-px", linked ? "bg-gradient-to-r from-eng to-data md:bg-gradient-to-b" : "bg-line")} />
                  {linked && <span className="absolute size-1.5 rounded-full bg-ink blink-soft" style={{ animationDelay: `${i * 0.2}s` }} />}
                </div>
                <div className={cx("rounded-lg border p-3 transition-all duration-500", dataOn ? "border-data/50 bg-data-deep/70 opacity-100" : "border-line bg-panel/60 opacity-35")}>
                  <p className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-data-ink">DATA · {String(i + 1).padStart(2, "0")}</p>
                  <p className="mt-1 text-[0.82rem] font-medium leading-snug text-ink">{p.data}</p>
                  <p className={cx("mt-1 text-[0.72rem] leading-snug text-mute", !dataOn && "sr-only")}>{p.dataD}</p>
                </div>
                {linked && (
                  <p className="col-span-3 -mt-1 text-center font-mono text-[0.6rem] uppercase tracking-[0.08em] text-dim md:col-span-1 md:mt-1">{p.link}</p>
                )}
              </li>
            ))}
          </ol>
        </div>

        {/* Narrative */}
        <div key={view} className="rise-in" aria-live="polite">
          <p className={cx("font-mono text-xs uppercase tracking-[0.12em]", view === "eng" ? "text-eng-ink" : view === "data" ? "text-data-ink" : "text-ink")}>{v.who}</p>
          <p className="mt-3 leading-relaxed text-mute">{v.summary}</p>
          <ul className="mt-6 space-y-2.5">
            {v.items.map((it) => (
              <li key={it} className="flex gap-3 text-sm text-ink">
                <span aria-hidden className={cx("mt-[0.45rem] size-1.5 shrink-0 rounded-full", view === "eng" ? "bg-eng" : view === "data" ? "bg-data" : "bg-ok")} />
                {it}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
