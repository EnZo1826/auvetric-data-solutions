import type { ProjectStatus } from "@/data/projects";
import { cx } from "./primitives";

const tone: Record<ProjectStatus, string> = {
  Operational: "text-ok border-ok/35",
  "In Development": "text-data-ink border-data/35",
  "Prototype / Experiment": "text-warn border-warn/35",
  "Working Concept": "text-mute border-line-strong",
};

export function StatusBadge({ status, className }: { status: ProjectStatus; verified?: boolean; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2 rounded-full border px-2.5 py-1 font-mono text-[0.68rem] uppercase tracking-[0.08em]", tone[status], className)}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}
