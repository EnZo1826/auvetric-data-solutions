import { cx } from "./primitives";

/** Original NEXUS mark: two signal paths (engineering + data) converging into a node. */
export function NexusMark({ className, title = "NEXUS / INTELLIGENCE" }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cx("size-8", className)} role="img" aria-label={title}>
      <path d="M4 8 L13 16 L4 24" fill="none" stroke="#DA3633" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M28 8 L19 16 L28 24" fill="none" stroke="#00C8D7" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="16" cy="16" r="3.2" fill="#F3F6FA" />
      <circle cx="16" cy="16" r="6.5" fill="none" stroke="#F3F6FA" strokeOpacity="0.25" strokeWidth="1" />
    </svg>
  );
}
