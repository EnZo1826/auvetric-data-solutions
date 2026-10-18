import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("mx-auto w-full max-w-[1280px] px-5 sm:px-8", className)}>{children}</div>;
}

export function Section({ id, className, children, labelledBy }: { id?: string; className?: string; children: ReactNode; labelledBy?: string }) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={cx("relative py-24 sm:py-32", className)}>
      {children}
    </section>
  );
}

/** Large section heading. `tone` adds a discipline-coloured rule, not an eyebrow. */
export function SectionHeading({ id, title, intro, tone = "converge", align = "left", className }: {
  id?: string; title: ReactNode; intro?: ReactNode; tone?: "eng" | "data" | "converge"; align?: "left" | "center"; className?: string;
}) {
  const rule = tone === "eng" ? "bg-eng" : tone === "data" ? "bg-data" : "bg-gradient-to-r from-eng to-data";
  return (
    <div className={cx("max-w-3xl", align === "center" && "mx-auto text-center", className)}>
      <span aria-hidden className={cx("mb-7 block h-[2px] w-14", rule, align === "center" && "mx-auto")} />
      <h2 id={id} className="font-display text-[clamp(2rem,4.4vw,3.6rem)] font-semibold leading-[1.02] tracking-[-0.035em] text-balance text-ink">
        {title}
      </h2>
      {intro && <p className="mt-6 max-w-[62ch] text-lg leading-relaxed text-mute text-pretty">{intro}</p>}
    </div>
  );
}

type BtnVariant = "primary" | "ghost" | "eng" | "data";
const btn: Record<BtnVariant, string> = {
  primary: "bg-ink text-void hover:bg-white shadow-[0_8px_30px_-10px_rgba(0,200,215,0.55)]",
  ghost: "border border-line-strong text-ink hover:border-mute hover:bg-white/[0.03]",
  eng: "bg-eng text-white hover:bg-[#e64a47]",
  data: "bg-data text-void hover:bg-[#2fd9e6]",
};

export function ButtonLink({ href, children, variant = "primary", className, external, ...rest }: {
  href: string; children: ReactNode; variant?: BtnVariant; className?: string; external?: boolean;
} & Omit<ComponentProps<typeof Link>, "href" | "className" | "children">) {
  const cls = cx(
    "group inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-6 py-3 text-[0.95rem] font-medium transition-[background,border-color,transform,box-shadow] duration-300 ease-[var(--ease-out-expo)] active:scale-[0.98]",
    btn[variant],
    className,
  );
  if (external)
    return (
      <a href={href} className={cls} target="_blank" rel="noreferrer noopener">
        {children}
        <ArrowUpRight aria-hidden className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </a>
    );
  return (
    <Link href={href} className={cls} {...rest}>
      {children}
    </Link>
  );
}

export function Chip({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "eng" | "data" | "ok" | "warn"; className?: string }) {
  const t = {
    neutral: "border-line-strong text-mute",
    eng: "border-eng/40 text-eng-ink bg-eng/[0.06]",
    data: "border-data/40 text-data-ink bg-data/[0.06]",
    ok: "border-ok/40 text-ok bg-ok/[0.06]",
    warn: "border-warn/40 text-warn bg-warn/[0.06]",
  }[tone];
  return <span className={cx("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[0.7rem] uppercase tracking-[0.08em]", t, className)}>{children}</span>;
}

/** Synthetic-data label for every simulated interface. */
export function SyntheticTag({ children = "Synthetic demonstration data" }: { children?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-md border border-warn/30 bg-warn/[0.06] px-2.5 py-1 font-mono text-[0.68rem] uppercase tracking-[0.1em] text-warn">
      <span aria-hidden className="size-1.5 rounded-full bg-warn" />
      {children}
    </span>
  );
}
