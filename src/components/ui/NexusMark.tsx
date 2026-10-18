import { AgencyLogo } from "./AgencyLogo";

/** Compatibility export for any downstream imports; use AgencyLogo in new components. */
export function NexusMark({ className }: { className?: string; title?: string }) {
  return <AgencyLogo className={className} />;
}
