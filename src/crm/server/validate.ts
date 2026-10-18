/** Zod building blocks for CRM request bodies. */
import { z } from "zod";
import { uid } from "@/crm/shared/calc";

export const text = (max: number) => z.string().max(max, `Keep this under ${max} characters.`).default("");
export const name = (label: string, max = 300) => z.string().trim().min(1, `${label} is required.`).max(max);
export const money = z.coerce.number().refine(Number.isFinite, "Enter a valid amount.").refine((n) => Math.abs(n) < 1e10, "Amount is too large.");
export const qty = z.coerce.number().refine(Number.isFinite, "Enter a valid quantity.").refine((n) => Math.abs(n) < 1e7, "Quantity is too large.");
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.").refine((s) => !Number.isNaN(Date.parse(s + "T00:00:00Z")), "Use a valid date.");
export const optDate = z.union([isoDate, z.literal(""), z.null()]).optional().transform((v) => (v ? v : null));
export const idRef = z.union([z.string().regex(/^\d{1,18}$/), z.number().int().positive(), z.literal(""), z.null()]).optional()
  .transform((v) => (v === "" || v == null ? null : String(v)));
export const currency = z.enum(["NAD", "USD"]);
export const practice = z.enum(["engineering", "data", "automation", "consultancy"]);
export const email = z.union([z.literal(""), z.string().trim().max(254).email("Enter a valid email address.")]).default("");

export const LineZ = z.object({
  id: z.string().max(40).optional(),
  item: text(300),
  description: text(4000),
  unit: text(30),
  qty: qty.default(1),
  rate: money.default(0),
  service_id: idRef,
}).transform((l) => ({ ...l, id: l.id && /^[\w-]+$/.test(l.id) ? l.id : uid() }));

export const LinesZ = z.array(LineZ).max(300, "A document can have at most 300 lines.").default([]);
