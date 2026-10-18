"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { caseStudies, categories, type Category } from "@/data/projects";
import { CaseStudyCard } from "./CaseStudyCard";
import { cx } from "@/components/ui/primitives";

type Group = "all" | "engineering" | "data" | "unified";

export function CaseStudyGallery() {
  const [cat, setCat] = useState<Category | "All">("All");
  const [group, setGroup] = useState<Group>("all");
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return caseStudies.filter(
      (c) =>
        (cat === "All" || c.category.includes(cat)) &&
        (group === "all" || c.group === group) &&
        (!needle || [c.title, c.shortDescription, c.domain, ...c.technologies].join(" ").toLowerCase().includes(needle)),
    );
  }, [cat, group, q]);

  return (
    <div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div role="radiogroup" aria-label="Discipline" className="inline-flex flex-wrap gap-1 rounded-xl border border-line p-1">
          {([
            ["all", "All work"],
            ["engineering", "Engineering"],
            ["data", "Data & BI"],
            ["unified", "Unified concepts"],
          ] as const).map(([id, label]) => (
            <button key={id} role="radio" aria-checked={group === id} onClick={() => setGroup(id)} className={cx("min-h-10 rounded-lg px-3.5 text-sm", group === id ? "bg-raised text-ink" : "text-mute hover:text-ink")}>
              {label}
            </button>
          ))}
        </div>
        <label className="relative block lg:w-80">
          <span className="sr-only">Search projects</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dim" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by technology, domain…"
            className="min-h-11 w-full rounded-xl border border-line bg-base pl-9 pr-3 text-sm text-ink placeholder:text-dim focus:border-data/60 focus:outline-none"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Category">
        {(["All", ...categories] as const).map((c) => (
          <button
            key={c}
            role="radio"
            aria-checked={cat === c}
            onClick={() => setCat(c)}
            className={cx("min-h-9 rounded-full border px-3 text-xs transition-colors", cat === c ? "border-ink/50 bg-white/[0.06] text-ink" : "border-line text-mute hover:text-ink")}
          >
            {c}
          </button>
        ))}
      </div>

      <p className="mt-6 text-sm text-dim" aria-live="polite">{list.length} {list.length === 1 ? "project" : "projects"}</p>
      {list.length ? (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((c) => <li key={c.slug}><CaseStudyCard c={c} /></li>)}
        </ul>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-line p-10 text-center">
          <p className="text-ink">No projects match those filters.</p>
          <button type="button" onClick={() => { setCat("All"); setGroup("all"); setQ(""); }} className="mt-3 text-sm text-data-ink underline">Clear filters</button>
        </div>
      )}
    </div>
  );
}
