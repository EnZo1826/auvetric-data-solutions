import { agency } from "@/data/agency";
import { cx } from "./primitives";

/** Supplied logo adapted horizontally for the existing compact dark header/footer. */
export function AgencyLogo({ className }: { className?: string }) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  return (
    // The bundled PNG is already optimised; plain img also works in the static Pages export.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${basePath}/brand/auvetric-lockup-dark.png`}
      alt={agency.name}
      width={480}
      height={112}
      className={cx("h-auto w-[212px] shrink-0", className)}
    />
  );
}
