"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { techGroups, techLevelLabel, type TechLevel } from "@/data/technologies";
import { caseStudyBySlug } from "@/data/projects";
import { founderById, type FounderId } from "@/data/founders";
import { cx } from "@/components/ui/primitives";

const levelTone: Record<TechLevel, string> = {
  practical: "bg-ok",
  working: "bg-data",
  exploring: "bg-warn",
  site: "bg-ink",
};

/** CapabilityMatrix: technology ↔ function ↔ person ↔ evidence. */
export function TechEcosystem() {
  const [group, setGroup] = useState(techGroups[0].id);
  const [who, setWho] = useState<FounderId | "all">("all");
  const [level, setLevel] = useState<TechLevel | "all">("all");
  const g = techGroups.find((x) => x.id === group)!;

  const techs = useMemo(() => g.techs.filter((t) => (who === "all" || t.who.includes(who)) && (level === "all" || t.level === level)), [g, who, level]);

  return (
    <div className="rounded-3xl border border-line bg-base">
      <div className="flex flex-col gap-4 border-b border-line p-4 sm:p-6">
        <div role="tablist" aria-label="Technology function" className="flex flex-wrap gap-2">
          {techGroups.map((x) => (
            <button key={x.id} role="tab" aria-selected={x.id === group} aria-controls="tech-panel" onClick={() => setGroup(x.id)}
              className={cx("min-h-10 rounded-xl border px-3.5 text-sm", x.id === group ? "border-ink/30 bg-raised text-ink" : "border-line text-mute hover:text-ink")}>
              <span aria-hidden className={cx("mr-2 inline-block size-1.5 rounded-full align-middle", x.accent === "eng" ? "bg-eng" : x.accent === "data" ? "bg-data" : "bg-gradient-to-r from-eng to-data")} />
              {x.name}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-xs">
          <label className="flex items-center gap-2 text-dim">
            Partner
            <select value={who} onChange={(e) => setWho(e.target.value as FounderId | "all")} className="min-h-9 rounded-lg border border-line bg-panel px-2 text-ink">
              <option value="all">Both</option>
              <option value="jakes">Jakes9NA</option>
              <option value="alex">Alex</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-dim">
            Status
            <select value={level} onChange={(e) => setLevel(e.target.value as TechLevel | "all")} className="min-h-9 rounded-lg border border-line bg-panel px-2 text-ink">
              <option value="all">All</option>
              {(Object.keys(techLevelLabel) as TechLevel[]).map((l) => <option key={l} value={l}>{techLevelLabel[l]}</option>)}
            </select>
          </label>
          <ul className="flex flex-wrap gap-4 text-dim" aria-label="Legend">
            {(Object.keys(techLevelLabel) as TechLevel[]).map((l) => (
              <li key={l} className="inline-flex items-center gap-1.5"><span className={cx("size-2 rounded-full", levelTone[l])} />{techLevelLabel[l]}</li>
            ))}
          </ul>
        </div>
      </div>
      <div id="tech-panel" role="tabpanel" className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <caption className="sr-only">{g.name}: technologies, status, partner and evidence</caption>
          <thead>
            <tr className="border-b border-line font-mono text-[0.65rem] uppercase tracking-[0.1em] text-dim">
              <th scope="col" className="px-6 py-3 font-normal">Technology</th>
              <th scope="col" className="px-3 py-3 font-normal">Role in a solution</th>
              <th scope="col" className="px-3 py-3 font-normal">Status</th>
              <th scope="col" className="px-3 py-3 font-normal">Partner</th>
              <th scope="col" className="px-6 py-3 font-normal">Evidence</th>
            </tr>
          </thead>
          <tbody key={`${group}-${who}-${level}`} className="rise-in">
            {techs.map((t) => {
              const ev = t.evidence ? caseStudyBySlug(t.evidence) : undefined;
              return (
                <tr key={t.name} className="border-b border-line/60">
                  <th scope="row" className="px-6 py-3 font-medium text-ink">{t.name}</th>
                  <td className="px-3 py-3 text-mute">{t.role}</td>
                  <td className="px-3 py-3"><span className="inline-flex items-center gap-2 text-xs text-mute"><span className={cx("size-2 rounded-full", levelTone[t.level])} />{techLevelLabel[t.level]}</span></td>
                  <td className="px-3 py-3 text-xs text-mute">{t.who.map((w) => founderById(w).displayName).join(", ")}</td>
                  <td className="px-6 py-3 text-xs">{ev ? <Link href={`/work/${ev.slug}`} className="text-data-ink hover:underline">{ev.title}</Link> : <span className="text-dim">—</span>}</td>
                </tr>
              );
            })}
            {!techs.length && <tr><td colSpan={5} className="px-6 py-8 text-center text-dim">No technologies match these filters in {g.name}.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
