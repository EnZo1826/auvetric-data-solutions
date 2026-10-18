"use client";

import { useMemo, useState } from "react";
import { ChevronRight, RotateCcw, FastForward } from "lucide-react";
import { rawRecords, ruleText, runPipeline, type RuleId, type RawRecord } from "@/lib/integrity";
import { cx, SyntheticTag } from "@/components/ui/primitives";

const STAGES = [
  { id: "profile", name: "Data Profiling", logic: "Measure before you fix. Count completeness per field, invalid identifiers (EAN-13 check digits), barcodes used by more than one record, and how many spellings each supplier has. Nothing is changed yet." },
  { id: "standardise", name: "Standardisation", logic: "Apply safe, reversible formatting rules: trim and collapse whitespace, consistent title case and unit suffixes, and map every supplier alias to its canonical name. Each change records its rule and original value." },
  { id: "match", name: "Record Matching", logic: "Group records by barcode. Same barcode + same supplier SKU + same standardised description = the same product (a duplicate to merge). Same barcode but a different product = a collision that must never be auto-merged." },
  { id: "validate", name: "Validation", logic: "Run eight business rules against every record. The supplier master is the authority for case pack and case cost, so unit cost must equal case cost ÷ case pack. Margins must sit in a plausible band and each product must have one selling price." },
  { id: "exceptions", name: "Exception Detection", logic: "Every failed rule becomes an exception with a type, severity and accountable owner. Exceptions where an authoritative source exists are marked for automatic correction; the rest go to a person." },
  { id: "reconcile", name: "Reconciliation", logic: "Correct case packs and unit costs from the supplier master, merge true duplicates, then re-run validation. Cost corrections are multiplied by weekly units to quantify how far reported margin was wrong." },
  { id: "report", name: "Reporting", logic: "Report on the validated data — and on the data quality itself. Every figure below is calculated live in your browser from the 18 synthetic records above." },
] as const;

const nad = (n: number) => `N$${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const RULES = Object.keys(ruleText) as RuleId[];

export function DataIntegrityDemo() {
  const result = useMemo(() => runPipeline(rawRecords), []);
  const [stage, setStage] = useState(-1); // -1 = raw
  const [run, setRun] = useState(0); // re-keys the scan animation

  const go = (s: number) => { setStage(s); setRun((r) => r + 1); };
  const at = (s: string) => stage >= STAGES.findIndex((x) => x.id === s);

  const records: RawRecord[] = at("reconcile") ? result.reconciliation.records : at("standardise") ? result.standardised.records : rawRecords;

  const changedStd = new Map(result.standardised.changes.map((c) => [`${c.id}:${c.field}`, c]));
  const changedRec = new Map(result.reconciliation.corrections.map((c) => [`${c.id}:${c.field}`, c]));
  const groupOf = (id: string) => result.groups.find((g) => g.ids.includes(id))!;
  const failsFor = (id: string) => (at("reconcile") ? result.revalidation : result.validation).filter((v) => v.id === id && !v.pass).map((v) => v.rule);
  const merged = new Set(result.reconciliation.merged);
  const p = result.profile;

  const cellFlag = (r: RawRecord, field: keyof RawRecord): "warn" | "fix" | "std" | null => {
    if (at("reconcile") && changedRec.has(`${r.id}:${field}`)) return "fix";
    if (at("standardise") && !at("match") && changedStd.has(`${r.id}:${field}`)) return "std";
    if (at("profile") && !at("reconcile")) {
      if (field === "barcode" && (p.invalidBarcodes.includes(r.id) || p.recordsOnDuplicateBarcodes.includes(r.id))) return "warn";
      if ((field === "brand" || field === "category") && !String(r[field]).trim()) return "warn";
      if (field === "supplierName" && !at("standardise") && changedStd.has(`${r.id}:supplierName`)) return "warn";
      if (field === "description" && !at("standardise") && p.nonStandardDescriptions.includes(r.id)) return "warn";
    }
    return null;
  };

  const Cell = ({ r, f, children, className }: { r: RawRecord; f: keyof RawRecord; children: React.ReactNode; className?: string }) => {
    const flag = cellFlag(r, f);
    const prev = flag === "fix" ? changedRec.get(`${r.id}:${f}`)?.from : flag === "std" ? changedStd.get(`${r.id}:${f}`)?.from : undefined;
    return (
      <td className={cx("whitespace-nowrap px-3 py-2 transition-colors duration-500", flag === "warn" && "bg-warn/[0.09] text-warn", flag === "fix" && "bg-ok/[0.08] text-ok", flag === "std" && "bg-data/[0.08] text-data-ink", className)}>
        {children}
        {prev !== undefined && <span className="block text-[0.65rem] text-dim line-through">{typeof prev === "number" ? prev.toFixed(2) : `“${prev}”`}</span>}
      </td>
    );
  };

  const k = result.kpis;
  const current = stage >= 0 ? STAGES[stage] : null;

  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-base">
      {/* Stage rail */}
      <div className="border-b border-line p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SyntheticTag>Synthetic FMCG dataset · 18 records · 4 suppliers</SyntheticTag>
          <div className="flex gap-2">
            <button type="button" onClick={() => go(STAGES.length - 1)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-3 text-xs text-ink hover:border-mute">
              <FastForward className="size-4" aria-hidden /> Run all stages
            </button>
            <button type="button" onClick={() => go(-1)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-3 text-xs text-ink hover:border-mute">
              <RotateCcw className="size-4" aria-hidden /> Reset
            </button>
          </div>
        </div>
        <ol className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7" aria-label="Pipeline stages">
          {STAGES.map((s, i) => {
            const done = i < stage, on = i === stage, next = i === stage + 1;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => go(i)}
                  aria-current={on ? "step" : undefined}
                  className={cx(
                    "relative flex min-h-14 w-full flex-col justify-center overflow-hidden rounded-xl border px-3 py-2 text-left transition-colors",
                    on ? "border-data/60 bg-data/10" : done ? "border-ok/30 bg-ok/[0.04]" : next ? "border-line-strong hover:border-mute" : "border-line hover:border-line-strong",
                  )}
                >
                  <span className={cx("font-mono text-[0.62rem]", on ? "text-data-ink" : done ? "text-ok" : "text-dim")}>{String(i + 1).padStart(2, "0")}{done && " · done"}</span>
                  <span className={cx("text-[0.82rem] leading-tight", on || done ? "text-ink" : "text-mute")}>{s.name}</span>
                  {next && <ChevronRight className="absolute right-2 top-1/2 size-4 -translate-y-1/2 text-dim" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ol>
        <div aria-live="polite" className="mt-5 min-h-[3rem] max-w-[90ch] text-sm leading-relaxed text-mute">
          {current ? (
            <p key={current.id} className="rise-in"><span className="font-medium text-ink">{current.name}. </span>{current.logic}</p>
          ) : (
            <p>
              <span className="font-medium text-ink">Raw extract. </span>
              Eighteen product records from two stores, as they arrive from the retail ERP. They contain duplicate barcodes, missing attributes, incorrect unit costs, conflicting selling prices, case-pack inconsistencies and supplier mismatches. Select a stage, or step through in order.
            </p>
          )}
        </div>
        {stage < STAGES.length - 1 && (
          <button type="button" onClick={() => go(stage + 1)} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full bg-data px-5 text-sm font-medium text-void hover:bg-[#2fd9e6]">
            Run {STAGES[stage + 1].name} <ChevronRight className="size-4" aria-hidden />
          </button>
        )}
      </div>

      {/* Stage summary */}
      {stage >= 0 && (
        <div key={`sum-${stage}`} className="rise-in border-b border-line bg-panel/50 p-4 sm:p-6">
          <StageSummary stageId={STAGES[stage].id} result={result} />
        </div>
      )}

      {/* Table */}
      {STAGES[stage]?.id !== "report" && (
        <div className="relative">
          <div key={run} aria-hidden className={cx("pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-transparent via-data/20 to-transparent", run > 0 && "animate-[scan_1.1s_cubic-bezier(.16,1,.3,1)_both]")} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] border-collapse text-left text-[0.8rem] tabular">
              <caption className="sr-only">Synthetic product records at stage: {current?.name ?? "raw extract"}</caption>
              <thead>
                <tr className="border-b border-line font-mono text-[0.65rem] uppercase tracking-[0.08em] text-dim">
                  {["ID", "Store", "Barcode", "Description", "Brand", "Category", "Supplier", "Pack", "Unit cost", "Sell", "Margin", at("validate") ? "Rules failed" : at("match") ? "Match" : ""].map((h) => (
                    <th key={h || "x"} scope="col" className="sticky top-0 bg-base px-3 py-2.5 font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((r, i) => {
                  const g = groupOf(r.id);
                  const isMerged = at("reconcile") && merged.has(r.id);
                  const fails = at("validate") ? failsFor(r.id) : [];
                  const margin = (r.sellPrice - r.unitCost) / r.sellPrice;
                  return (
                    <tr
                      key={r.id}
                      className={cx("border-b border-line/70 text-mute transition-opacity", isMerged && "opacity-35", run > 0 && "animate-[rowin_.6s_cubic-bezier(.16,1,.3,1)_both]")}
                      style={{ animationDelay: `${i * 35}ms` }}
                    >
                      <td className="sticky left-0 bg-base px-3 py-2 font-mono text-ink">{r.id}</td>
                      <td className="px-3 py-2 font-mono text-dim">{r.store}</td>
                      <Cell r={r} f="barcode" className="font-mono">{r.barcode}</Cell>
                      <Cell r={r} f="description" className="text-ink">{r.description}</Cell>
                      <Cell r={r} f="brand">{r.brand || "—"}</Cell>
                      <Cell r={r} f="category">{r.category || "—"}</Cell>
                      <Cell r={r} f="supplierName">{r.supplierName}</Cell>
                      <Cell r={r} f="casePack" className="text-right">{r.casePack}</Cell>
                      <Cell r={r} f="unitCost" className="text-right">{r.unitCost.toFixed(2)}</Cell>
                      <td className="px-3 py-2 text-right">{r.sellPrice.toFixed(2)}</td>
                      <td className={cx("px-3 py-2 text-right", (margin < 0.1 || margin > 0.6) && at("validate") && "text-warn")}>{(margin * 100).toFixed(1)}%</td>
                      <td className="px-3 py-2">
                        {at("validate") ? (
                          fails.length ? (
                            <span className="flex flex-wrap gap-1">{fails.map((f) => <span key={f} title={ruleText[f]} className="rounded border border-warn/40 px-1.5 py-0.5 font-mono text-[0.62rem] text-warn">{f.slice(0, 2)}</span>)}</span>
                          ) : isMerged ? <span className="font-mono text-[0.65rem] text-dim">merged → {g.survivor}</span> : <span className="font-mono text-[0.65rem] text-ok">PASS</span>
                        ) : at("match") ? (
                          g.kind === "duplicate" ? <span className="font-mono text-[0.65rem] text-data-ink">{r.id === g.survivor ? "survivor" : `duplicate of ${g.survivor}`}</span>
                          : g.kind === "collision" ? <span className="font-mono text-[0.65rem] text-warn">collision · {g.ids.join("/")}</span>
                          : <span className="font-mono text-[0.65rem] text-dim">unique</span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Legend />
        </div>
      )}
      <style>{`
        @keyframes scan { from { transform: translateX(-100%); opacity: 1 } to { transform: translateX(1400%); opacity: 0 } }
        @keyframes rowin { from { background: rgba(0,200,215,.08) } to { background: transparent } }
      `}</style>
      {/* Hidden helper to keep KPI references for screen readers when reporting */}
      {STAGES[stage]?.id === "report" && <p className="sr-only">Report: {k.validAfter} of {k.uniqueProducts} products valid after reconciliation.</p>}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-4 border-t border-line px-4 py-3 text-[0.7rem] text-dim sm:px-6">
      <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-warn/40" /> Issue detected</span>
      <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-data/40" /> Standardised</span>
      <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-ok/40" /> Corrected from authority</span>
      <span>Rule codes: {RULES.map((r) => r.slice(0, 2)).join(", ")} — hover for definitions</span>
    </div>
  );
}

function Stat({ label, value, tone = "ink", note }: { label: string; value: string | number; tone?: "ink" | "ok" | "warn" | "data" | "eng"; note?: string }) {
  const c = { ink: "text-ink", ok: "text-ok", warn: "text-warn", data: "text-data-ink", eng: "text-eng-ink" }[tone];
  return (
    <div className="rounded-xl border border-line bg-base p-4">
      <p className="text-xs text-dim">{label}</p>
      <p className={cx("mt-1 font-display text-2xl tabular", c)}>{value}</p>
      {note && <p className="mt-1 font-mono text-[0.65rem] text-dim">{note}</p>}
    </div>
  );
}

function StageSummary({ stageId, result }: { stageId: (typeof STAGES)[number]["id"]; result: ReturnType<typeof runPipeline> }) {
  const p = result.profile, k = result.kpis;
  if (stageId === "profile")
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Records" value={p.total} />
          <Stat label="Shared barcodes" value={p.duplicateBarcodes.length} tone="warn" note={`${p.recordsOnDuplicateBarcodes.length} records`} />
          <Stat label="Invalid EAN-13" value={p.invalidBarcodes.length} tone="warn" note={p.invalidBarcodes.join(", ")} />
          <Stat label="Supplier spellings" value={p.supplierNameVariants} tone="warn" note={`for ${p.distinctSuppliers} suppliers`} />
        </div>
        <div>
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.1em] text-dim">Completeness by field</p>
          <ul className="mt-2 space-y-1.5">
            {p.completeness.map((c) => {
              const pct = (c.filled / c.total) * 100;
              return (
                <li key={c.field} className="grid grid-cols-[7rem_1fr_3.5rem] items-center gap-3 text-xs">
                  <span className="text-mute">{c.field}</span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-line"><span className={cx("block h-full rounded-full", pct < 100 ? "bg-warn" : "bg-ok")} style={{ width: `${pct}%` }} /></span>
                  <span className="text-right font-mono text-dim tabular">{pct.toFixed(1)}%</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    );
  if (stageId === "standardise")
    return (
      <div>
        <p className="text-sm text-mute"><span className="text-ink">{result.standardised.changes.length} values standardised</span> — descriptions {result.standardised.changes.filter((c) => c.field === "description").length}, supplier names {result.standardised.changes.filter((c) => c.field === "supplierName").length}. Supplier spellings reduced from {p.supplierNameVariants} to {new Set(result.standardised.records.map((r) => r.supplierName)).size}.</p>
        <ul className="mt-3 grid gap-1.5 font-mono text-[0.72rem] sm:grid-cols-2">
          {result.standardised.changes.map((c) => (
            <li key={`${c.id}${c.field}`} className="truncate text-dim"><span className="text-ink">{c.id}</span> {c.field}: “{String(c.from)}” → <span className="text-data-ink">“{String(c.to)}”</span></li>
          ))}
        </ul>
      </div>
    );
  if (stageId === "match") {
    const dup = result.groups.filter((g) => g.kind === "duplicate"), col = result.groups.filter((g) => g.kind === "collision");
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Barcode groups" value={result.groups.length} />
        <Stat label="True duplicates" value={dup.length} tone="data" note={dup.map((g) => g.ids.join("+")).join(", ")} />
        <Stat label="Collisions" value={col.length} tone="warn" note={col.map((g) => g.ids.join("/")).join(", ")} />
        <Stat label="Products after merge" value={k.uniqueProducts} />
      </div>
    );
  }
  if (stageId === "validate") {
    const v = result.validation;
    return (
      <ul className="grid gap-x-8 gap-y-1.5 sm:grid-cols-2">
        {RULES.map((r) => {
          const all = v.filter((x) => x.rule === r), fail = all.filter((x) => !x.pass).length;
          return (
            <li key={r} className="flex items-center justify-between gap-4 border-b border-line/60 py-1.5 text-xs">
              <span className="text-mute"><span className="mr-2 font-mono text-dim">{r.slice(0, 2)}</span>{ruleText[r]}</span>
              <span className={cx("font-mono tabular", fail ? "text-warn" : "text-ok")}>{fail ? `${fail} fail` : "all pass"}</span>
            </li>
          );
        })}
      </ul>
    );
  }
  if (stageId === "exceptions")
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-xs">
          <caption className="sr-only">Exceptions detected</caption>
          <thead><tr className="font-mono text-[0.62rem] uppercase tracking-[0.08em] text-dim">{["Record", "Type", "Severity", "Owner", "Detail", "Resolution"].map((h) => <th key={h} scope="col" className="py-1.5 pr-4 font-normal">{h}</th>)}</tr></thead>
          <tbody>
            {result.exceptions.map((e, i) => (
              <tr key={i} className="border-t border-line/60">
                <td className="py-1.5 pr-4 font-mono text-ink">{e.recordId}</td>
                <td className="py-1.5 pr-4 text-mute">{e.type}</td>
                <td className={cx("py-1.5 pr-4 font-mono", e.severity === "high" ? "text-eng-ink" : e.severity === "medium" ? "text-warn" : "text-dim")}>{e.severity}</td>
                <td className="py-1.5 pr-4 text-mute">{e.owner}</td>
                <td className="py-1.5 pr-4 text-dim">{e.detail}</td>
                <td className={cx("py-1.5 font-mono", e.resolution === "auto" ? "text-ok" : "text-warn")}>{e.resolution}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-dim">{result.exceptions.length} exceptions on {k.recordsWithExceptions} records · {result.exceptions.filter((e) => e.resolution === "auto").length} can be corrected from an authoritative source.</p>
      </div>
    );
  if (stageId === "reconcile")
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <ul className="space-y-1.5 font-mono text-[0.72rem]">
          {result.reconciliation.corrections.map((c) => (
            <li key={`${c.id}${c.field}`} className="text-dim"><span className="text-ink">{c.id}</span> {c.field}: {String(c.from)} → <span className="text-ok">{String(c.to)}</span> <span className="text-dim">({c.rule})</span></li>
          ))}
          <li className="text-dim">Merged duplicates: <span className="text-ink">{result.reconciliation.merged.join(", ")}</span></li>
        </ul>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Weekly margin overstated" value={nad(k.weeklyMarginOverstatement)} tone="eng" note="true cost higher than ERP" />
          <Stat label="Weekly margin understated" value={nad(k.weeklyMarginUnderstatement)} tone="data" note="true cost lower than ERP" />
        </div>
      </div>
    );
  // report
  const max = Math.max(...result.byType.map(([, n]) => n));
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Valid records (before)" value={`${k.validInitially} / ${k.rawRecords}`} />
        <Stat label="Records with exceptions" value={k.recordsWithExceptions} tone="warn" note={`${k.totalExceptions} rule failures`} />
        <Stat label="Duplicate identifiers" value={k.duplicateIdentifiers} tone="warn" note={`${k.duplicatesMerged} merged`} />
        <Stat label="Pricing discrepancies" value={k.pricingDiscrepancies} tone="warn" note="records" />
        <Stat label="Auto-corrected values" value={k.autoCorrected} tone="ok" note="from supplier master" />
        <Stat label="Manual review" value={k.manualReview} tone="eng" note={`${k.manualExceptions} open exceptions`} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-xl border border-line bg-base p-4">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.1em] text-dim">Exceptions by type (before reconciliation)</p>
          <ul className="mt-3 space-y-2">
            {result.byType.map(([type, n]) => (
              <li key={type} className="grid grid-cols-[9.5rem_1fr_2rem] items-center gap-3 text-xs">
                <span className="text-mute">{type}</span>
                <span className="h-2 overflow-hidden rounded-full bg-line"><span className="block h-full rounded-full bg-gradient-to-r from-warn to-eng" style={{ width: `${(n / max) * 100}%` }} /></span>
                <span className="text-right font-mono text-ink tabular">{n}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-line bg-base p-4">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.1em] text-dim">Before → after</p>
          <dl className="mt-3 grid grid-cols-[1fr_auto_auto] gap-x-6 gap-y-2 text-sm tabular">
            <dt className="text-mute">Products</dt><dd className="text-dim">{k.rawRecords}</dd><dd className="text-ink">{k.uniqueProducts}</dd>
            <dt className="text-mute">Valid</dt><dd className="text-dim">{k.validInitially}</dd><dd className="text-ok">{k.validAfter}</dd>
            <dt className="text-mute">Need a person</dt><dd className="text-dim">{k.recordsWithExceptions}</dd><dd className="text-warn">{k.manualReview}</dd>
          </dl>
          <p className="mt-4 text-xs leading-relaxed text-dim">Remaining exceptions are deliberately left for people: barcode collisions, an invalid barcode, an unknown supplier SKU, missing attributes, a below-cost selling price and a cross-store price conflict. No rule can decide those safely.</p>
        </div>
      </div>
      <details className="rounded-xl border border-line bg-base p-4 text-xs text-mute">
        <summary className="cursor-pointer text-ink">How these figures are calculated</summary>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>All values are computed in the browser from the 18 bundled synthetic records by <code className="font-mono text-data-ink">src/lib/integrity.ts</code>, and asserted by <code className="font-mono text-data-ink">npm run verify:data</code>.</li>
          <li>Weekly margin effect = (supplier unit cost − ERP unit cost) × weekly units, summed by sign.</li>
          <li>“Manual review” counts surviving products (after merging duplicates) that still fail at least one rule.</li>
        </ul>
      </details>
    </div>
  );
}
