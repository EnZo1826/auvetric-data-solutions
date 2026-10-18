/**
 * Synthetic FMCG master-data integrity demonstration.
 *
 * Every figure displayed in the Data Intelligence demo is computed by the functions in this file
 * from the bundled synthetic dataset below — nothing is hard-coded. Barcodes use the GS1 "200"
 * restricted-circulation prefix so they cannot collide with real retail products.
 *
 * This module has no imports so it can be verified directly with `npm run verify:data` (Node ≥ 22.6).
 */

// ───────────────────────────── helpers ─────────────────────────────
export function eanCheckDigit(stem12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(stem12[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10;
}
export const isValidEan13 = (code: string) => /^\d{13}$/.test(code) && eanCheckDigit(code.slice(0, 12)) === Number(code[12]);
const ean = (stem: string) => stem + eanCheckDigit(stem);
const badEan = (stem: string) => stem + ((eanCheckDigit(stem) + 3) % 10);
const round2 = (n: number) => Math.round(n * 100) / 100;

// ───────────────────────────── reference (authority) data ─────────────────────────────
export interface Supplier { id: string; name: string; aliases: string[] }
export const suppliers: Supplier[] = [
  { id: "S01", name: "Namib Valley Foods", aliases: ["NAMIB VALLEY FOODS (PTY) LTD", "N.V. Foods", "Namib Valley Foods"] },
  { id: "S02", name: "Kalahari Beverages", aliases: ["KALAHARI BEV", "Kalahari Beverages CC", "Kalahari Beverages"] },
  { id: "S03", name: "Etosha Home Care", aliases: ["ETOSHA HOMECARE", "Etosha Home Care"] },
  { id: "S04", name: "Skeleton Coast Dairy", aliases: ["SKELETON COAST DAIRY", "Skeleton Coast Dairy"] },
];

/** Supplier product master — the authority for case pack and case cost. */
export interface SupplierItem { sku: string; supplierId: string; casePack: number; caseCost: number }
export const supplierItems: SupplierItem[] = [
  { sku: "NV-1001", supplierId: "S01", casePack: 12, caseCost: 516.0 },
  { sku: "NV-1002", supplierId: "S01", casePack: 4, caseCost: 238.0 },
  { sku: "NV-1003", supplierId: "S01", casePack: 12, caseCost: 414.0 },
  { sku: "NV-1004", supplierId: "S01", casePack: 10, caseCost: 395.0 },
  { sku: "KB-2001", supplierId: "S02", casePack: 24, caseCost: 192.0 },
  { sku: "KB-2002", supplierId: "S02", casePack: 6, caseCost: 135.0 },
  { sku: "KB-2003", supplierId: "S02", casePack: 12, caseCost: 228.0 },
  { sku: "KB-2004", supplierId: "S02", casePack: 24, caseCost: 456.0 },
  { sku: "EH-3001", supplierId: "S03", casePack: 12, caseCost: 300.0 },
  { sku: "EH-3002", supplierId: "S03", casePack: 6, caseCost: 270.0 },
  { sku: "EH-3003", supplierId: "S03", casePack: 12, caseCost: 162.0 },
  { sku: "EH-3004", supplierId: "S03", casePack: 12, caseCost: 222.0 },
  { sku: "SD-4001", supplierId: "S04", casePack: 6, caseCost: 147.0 },
  { sku: "SD-4002", supplierId: "S04", casePack: 8, caseCost: 312.0 },
  { sku: "SD-4003", supplierId: "S04", casePack: 20, caseCost: 1190.0 },
];

// ───────────────────────────── raw retail ERP extract ─────────────────────────────
export interface RawRecord {
  id: string;
  store: string;
  barcode: string;
  description: string;
  brand: string;
  category: string;
  supplierName: string;
  supplierSku: string;
  casePack: number;
  unitCost: number; // N$ per unit, as held in the ERP
  sellPrice: number; // N$ per unit
  weeklyUnits: number;
}

export const rawRecords: RawRecord[] = [
  { id: "R01", store: "WHK-01", barcode: ean("200100100001"), description: "Rooibos Tea 80s", brand: "Desert Leaf", category: "Beverages", supplierName: "Namib Valley Foods", supplierSku: "NV-1001", casePack: 12, unitCost: 43.0, sellPrice: 54.99, weeklyUnits: 140 },
  { id: "R02", store: "SWK-02", barcode: ean("200100100001"), description: "  ROOIBOS TEA 80S ", brand: "Desert Leaf", category: "Beverages", supplierName: "NAMIB VALLEY FOODS (PTY) LTD", supplierSku: "NV-1001", casePack: 12, unitCost: 43.0, sellPrice: 54.99, weeklyUnits: 85 },
  { id: "R03", store: "WHK-01", barcode: ean("200100100002"), description: "Maize Meal 5kg", brand: "Namib Gold", category: "Pantry", supplierName: "Namib Valley Foods", supplierSku: "NV-1002", casePack: 6, unitCost: 39.67, sellPrice: 74.99, weeklyUnits: 310 },
  { id: "R04", store: "WHK-01", barcode: ean("200200200001"), description: "Sparkling Water 500ml", brand: "Spitzkoppe", category: "Beverages", supplierName: "KALAHARI BEV", supplierSku: "KB-2001", casePack: 24, unitCost: 7.2, sellPrice: 12.99, weeklyUnits: 620 },
  { id: "R05", store: "WHK-01", barcode: ean("200200200002"), description: "Cola 2L", brand: "Kala Cola", category: "Beverages", supplierName: "Kalahari Beverages", supplierSku: "KB-2002", casePack: 6, unitCost: 22.5, sellPrice: 29.99, weeklyUnits: 410 },
  { id: "R06", store: "SWK-02", barcode: ean("200200200002"), description: "COLA 2L", brand: "Kala Cola", category: "Beverages", supplierName: "Kalahari Beverages CC", supplierSku: "KB-2002", casePack: 6, unitCost: 22.5, sellPrice: 31.99, weeklyUnits: 260 },
  { id: "R07", store: "WHK-01", barcode: ean("200300300001"), description: "Dish Liquid 750ml", brand: "", category: "Household", supplierName: "Etosha Home Care", supplierSku: "EH-3001", casePack: 12, unitCost: 25.0, sellPrice: 34.99, weeklyUnits: 190 },
  { id: "R08", store: "WHK-01", barcode: ean("200300300002"), description: "Fabric Softener 2L", brand: "Etosha Fresh", category: "", supplierName: "ETOSHA HOMECARE", supplierSku: "EH-3002", casePack: 6, unitCost: 45.0, sellPrice: 59.99, weeklyUnits: 95 },
  { id: "R09", store: "WHK-01", barcode: ean("200400400001"), description: "Fresh Milk 2L", brand: "Coastline", category: "Dairy", supplierName: "Skeleton Coast Dairy", supplierSku: "SD-4001", casePack: 6, unitCost: 24.5, sellPrice: 32.99, weeklyUnits: 880 },
  { id: "R10", store: "WHK-01", barcode: ean("200400400002"), description: "Plain Yoghurt 1kg", brand: "Coastline", category: "Dairy", supplierName: "Skeleton Coast Dairy", supplierSku: "SD-4002", casePack: 8, unitCost: 39.0, sellPrice: 37.99, weeklyUnits: 150 },
  { id: "R11", store: "SWK-02", barcode: ean("200300300001"), description: "Peanut Butter 400g", brand: "Namib Gold", category: "Pantry", supplierName: "N.V. Foods", supplierSku: "NV-1003", casePack: 12, unitCost: 34.5, sellPrice: 44.99, weeklyUnits: 120 },
  { id: "R12", store: "WHK-01", barcode: badEan("200200200003"), description: "Orange Juice 1L", brand: "Spitzkoppe", category: "Beverages", supplierName: "Kalahari Beverages", supplierSku: "KB-2003", casePack: 12, unitCost: 19.0, sellPrice: 26.99, weeklyUnits: 300 },
  { id: "R13", store: "WHK-01", barcode: ean("200400400010"), description: "Cheddar Cheese 900g", brand: "Coastline", category: "Dairy", supplierName: "Skeleton Coast Dairy", supplierSku: "SD-4010", casePack: 10, unitCost: 112.0, sellPrice: 139.99, weeklyUnits: 70 },
  { id: "R14", store: "WHK-01", barcode: ean("200300300003"), description: "Bleach 750ml", brand: "Etosha Fresh", category: "Household", supplierName: "Etosha Home Care", supplierSku: "EH-3003", casePack: 12, unitCost: 13.5, sellPrice: 19.99, weeklyUnits: 240 },
  { id: "R15", store: "SWK-02", barcode: ean("200100100004"), description: "Long Grain Rice 2kg", brand: "Namib Gold", category: "Pantry", supplierName: "N.V. Foods", supplierSku: "NV-1004", casePack: 10, unitCost: 39.5, sellPrice: 49.99, weeklyUnits: 205 },
  { id: "R16", store: "WHK-01", barcode: ean("200200200004"), description: "Energy Drink 500ml", brand: "Dune Rush", category: "Beverages", supplierName: "Kalahari Beverages", supplierSku: "KB-2004", casePack: 12, unitCost: 38.0, sellPrice: 29.99, weeklyUnits: 330 },
  { id: "R17", store: "WHK-01", barcode: ean("200400400003"), description: "Salted Butter 500g", brand: "Coastline", category: "Dairy", supplierName: "Skeleton Coast Dairy", supplierSku: "SD-4003", casePack: 20, unitCost: 59.5, sellPrice: 79.99, weeklyUnits: 160 },
  { id: "R18", store: "SWK-02", barcode: ean("200300300004"), description: "toilet   cleaner 750ml", brand: "Etosha Fresh", category: "Household", supplierName: "Etosha Home Care", supplierSku: "EH-3004", casePack: 12, unitCost: 18.5, sellPrice: 26.99, weeklyUnits: 110 },
];

// ───────────────────────────── pipeline ─────────────────────────────
export type Field = keyof RawRecord;
export interface Change { id: string; field: Field; from: string | number; to: string | number; rule: string }

export type RuleId = "R1_MANDATORY" | "R2_EAN_VALID" | "R3_SUPPLIER_KNOWN" | "R4_PACK_MATCH" | "R5_UNIT_COST" | "R6_MARGIN_BAND" | "R7_UNIQUE_ID" | "R8_SINGLE_PRICE";
export const ruleText: Record<RuleId, string> = {
  R1_MANDATORY: "Brand and category are populated",
  R2_EAN_VALID: "Barcode is a valid EAN-13 (check digit)",
  R3_SUPPLIER_KNOWN: "Supplier SKU exists in the supplier master",
  R4_PACK_MATCH: "ERP case pack equals supplier case pack",
  R5_UNIT_COST: "ERP unit cost = supplier case cost ÷ case pack (±N$0.01)",
  R6_MARGIN_BAND: "Gross margin between 10% and 60%",
  R7_UNIQUE_ID: "Barcode identifies one product only",
  R8_SINGLE_PRICE: "One selling price per product across stores",
};

export type ExceptionType = "Missing attribute" | "Invalid barcode" | "Supplier mismatch" | "Case-pack mismatch" | "Unit-cost error" | "Pricing discrepancy" | "Barcode collision";
export interface DQException {
  recordId: string;
  rule: RuleId;
  type: ExceptionType;
  severity: "high" | "medium" | "low";
  owner: "Buying" | "Master data" | "Supplier" | "Pricing";
  detail: string;
  resolution: "auto" | "manual";
}

const ruleType: Record<RuleId, ExceptionType> = {
  R1_MANDATORY: "Missing attribute",
  R2_EAN_VALID: "Invalid barcode",
  R3_SUPPLIER_KNOWN: "Supplier mismatch",
  R4_PACK_MATCH: "Case-pack mismatch",
  R5_UNIT_COST: "Unit-cost error",
  R6_MARGIN_BAND: "Pricing discrepancy",
  R7_UNIQUE_ID: "Barcode collision",
  R8_SINGLE_PRICE: "Pricing discrepancy",
};

/** Trim, collapse whitespace, title-case words, litre suffix as "L" (e.g. "  COLA 2l " → "Cola 2L"). */
export const normDesc = (s: string) =>
  s.trim().replace(/\s+/g, " ").toLowerCase().replace(/(^|\s)([a-z])/g, (_m, sp: string, c: string) => sp + c.toUpperCase()).replace(/(\d)l\b/g, "$1L");

export function resolveSupplier(name: string): Supplier | undefined {
  const n = name.trim().toLowerCase();
  return suppliers.find((s) => s.aliases.some((a) => a.toLowerCase() === n) || s.name.toLowerCase() === n);
}

// Stage 1 — profiling
export function profile(records: RawRecord[]) {
  const byBarcode = new Map<string, RawRecord[]>();
  records.forEach((r) => byBarcode.set(r.barcode, [...(byBarcode.get(r.barcode) ?? []), r]));
  const duplicateBarcodes = [...byBarcode.entries()].filter(([, v]) => v.length > 1).map(([k]) => k);
  const supplierVariants = new Set(records.map((r) => r.supplierName)).size;
  const fields: Field[] = ["barcode", "description", "brand", "category", "supplierName", "supplierSku"];
  const completeness = fields.map((f) => ({ field: f, filled: records.filter((r) => String(r[f]).trim() !== "").length, total: records.length }));
  return {
    total: records.length,
    missingAttributes: records.filter((r) => !r.brand.trim() || !r.category.trim()).map((r) => r.id),
    invalidBarcodes: records.filter((r) => !isValidEan13(r.barcode)).map((r) => r.id),
    duplicateBarcodes,
    recordsOnDuplicateBarcodes: records.filter((r) => duplicateBarcodes.includes(r.barcode)).map((r) => r.id),
    supplierNameVariants: supplierVariants,
    distinctSuppliers: suppliers.length,
    nonStandardDescriptions: records.filter((r) => normDesc(r.description) !== r.description).map((r) => r.id),
    completeness,
  };
}

// Stage 2 — standardisation
export function standardise(records: RawRecord[]) {
  const changes: Change[] = [];
  const out = records.map((r) => {
    const next = { ...r };
    const d = normDesc(r.description);
    if (d !== r.description) { changes.push({ id: r.id, field: "description", from: r.description, to: d, rule: "Trim, collapse spaces, title case, unit suffixes" }); next.description = d; }
    const s = resolveSupplier(r.supplierName);
    if (s && s.name !== r.supplierName) { changes.push({ id: r.id, field: "supplierName", from: r.supplierName, to: s.name, rule: "Supplier alias → canonical name" }); next.supplierName = s.name; }
    return next;
  });
  return { records: out, changes };
}

// Stage 3 — record matching (same barcode + same supplier SKU + same standardised description = same product)
export interface MatchGroup { barcode: string; ids: string[]; kind: "duplicate" | "collision" | "single"; survivor: string }
export function match(records: RawRecord[]) {
  const groups = new Map<string, RawRecord[]>();
  records.forEach((r) => groups.set(r.barcode, [...(groups.get(r.barcode) ?? []), r]));
  const result: MatchGroup[] = [];
  for (const [barcode, rs] of groups) {
    if (rs.length === 1) { result.push({ barcode, ids: [rs[0].id], kind: "single", survivor: rs[0].id }); continue; }
    const sameProduct = rs.every((r) => r.supplierSku === rs[0].supplierSku && r.description === rs[0].description);
    result.push({ barcode, ids: rs.map((r) => r.id), kind: sameProduct ? "duplicate" : "collision", survivor: rs[0].id });
  }
  return result;
}

// Stage 4 — validation
export interface RuleResult { id: string; rule: RuleId; pass: boolean; detail: string }
export function validate(records: RawRecord[], groups: MatchGroup[]) {
  const results: RuleResult[] = [];
  for (const r of records) {
    const si = supplierItems.find((s) => s.sku === r.supplierSku);
    const missing = [!r.brand.trim() && "brand", !r.category.trim() && "category"].filter(Boolean).join(", ");
    results.push({ id: r.id, rule: "R1_MANDATORY", pass: !missing, detail: missing ? `Missing ${missing}` : "OK" });
    results.push({ id: r.id, rule: "R2_EAN_VALID", pass: isValidEan13(r.barcode), detail: isValidEan13(r.barcode) ? "OK" : `Check digit should be ${eanCheckDigit(r.barcode.slice(0, 12))}` });
    results.push({ id: r.id, rule: "R3_SUPPLIER_KNOWN", pass: !!si, detail: si ? "OK" : `${r.supplierSku} not in supplier master` });
    if (si) {
      results.push({ id: r.id, rule: "R4_PACK_MATCH", pass: si.casePack === r.casePack, detail: si.casePack === r.casePack ? "OK" : `ERP ${r.casePack} vs supplier ${si.casePack}` });
      const expected = round2(si.caseCost / si.casePack);
      const ok = Math.abs(expected - r.unitCost) <= 0.01;
      results.push({ id: r.id, rule: "R5_UNIT_COST", pass: ok, detail: ok ? "OK" : `ERP N$${r.unitCost.toFixed(2)} vs expected N$${expected.toFixed(2)}` });
    }
    const margin = (r.sellPrice - r.unitCost) / r.sellPrice;
    const inBand = margin >= 0.1 && margin <= 0.6;
    results.push({ id: r.id, rule: "R6_MARGIN_BAND", pass: inBand, detail: `Margin ${(margin * 100).toFixed(1)}%` });
    const g = groups.find((x) => x.ids.includes(r.id))!;
    results.push({ id: r.id, rule: "R7_UNIQUE_ID", pass: g.kind !== "collision", detail: g.kind === "collision" ? `Shared with ${g.ids.filter((i) => i !== r.id).join(", ")}` : "OK" });
    if (g.kind === "duplicate") {
      const prices = new Set(g.ids.map((i) => records.find((x) => x.id === i)!.sellPrice));
      results.push({ id: r.id, rule: "R8_SINGLE_PRICE", pass: prices.size === 1, detail: prices.size === 1 ? "OK" : `Prices: ${[...prices].map((p) => "N$" + p.toFixed(2)).join(" / ")}` });
    }
  }
  return results;
}

// Stage 5 — exception detection
const meta: Record<RuleId, Pick<DQException, "severity" | "owner">> = {
  R1_MANDATORY: { severity: "low", owner: "Master data" },
  R2_EAN_VALID: { severity: "high", owner: "Master data" },
  R3_SUPPLIER_KNOWN: { severity: "high", owner: "Buying" },
  R4_PACK_MATCH: { severity: "high", owner: "Master data" },
  R5_UNIT_COST: { severity: "high", owner: "Buying" },
  R6_MARGIN_BAND: { severity: "medium", owner: "Pricing" },
  R7_UNIQUE_ID: { severity: "high", owner: "Master data" },
  R8_SINGLE_PRICE: { severity: "medium", owner: "Pricing" },
};

/** Auto-resolvable: the supplier master is the authority for pack and cost; margin flags caused only by a wrong cost re-test after correction. */
export function detectExceptions(results: RuleResult[]): DQException[] {
  return results.filter((r) => !r.pass).map((r) => ({
    recordId: r.id,
    rule: r.rule,
    type: ruleType[r.rule],
    ...meta[r.rule],
    detail: r.detail,
    resolution: r.rule === "R4_PACK_MATCH" || r.rule === "R5_UNIT_COST" ? "auto" : "manual",
  }));
}

// Stage 6 — reconciliation
export function reconcile(records: RawRecord[], groups: MatchGroup[]) {
  const corrections: Change[] = [];
  const merged = new Set(groups.filter((g) => g.kind === "duplicate").flatMap((g) => g.ids.filter((i) => i !== g.survivor)));
  const out = records.map((r) => {
    const si = supplierItems.find((s) => s.sku === r.supplierSku);
    if (!si) return r;
    const next = { ...r };
    if (si.casePack !== r.casePack) { corrections.push({ id: r.id, field: "casePack", from: r.casePack, to: si.casePack, rule: "Supplier master is authority for case pack" }); next.casePack = si.casePack; }
    const expected = round2(si.caseCost / si.casePack);
    if (Math.abs(expected - r.unitCost) > 0.01) { corrections.push({ id: r.id, field: "unitCost", from: r.unitCost, to: expected, rule: "Unit cost = case cost ÷ case pack" }); next.unitCost = expected; }
    return next;
  });
  // weekly margin effect of cost corrections: (ERP cost − true cost) × weekly units. Positive = margin was overstated.
  const costEffects = corrections.filter((c) => c.field === "unitCost").map((c) => {
    const r = records.find((x) => x.id === c.id)!;
    return { id: c.id, perUnit: round2((c.to as number) - (c.from as number)), weekly: round2(((c.to as number) - (c.from as number)) * r.weeklyUnits) };
  });
  return { records: out, corrections, merged: [...merged], costEffects };
}

// Full run + KPIs (stage 7)
export function runPipeline(records: RawRecord[] = rawRecords) {
  const prof = profile(records);
  const std = standardise(records);
  const groups = match(std.records);
  const validation = validate(std.records, groups);
  const exceptions = detectExceptions(validation);
  const rec = reconcile(std.records, groups);
  const revalidation = validate(rec.records, groups);
  const remaining = detectExceptions(revalidation);

  const idsWith = (ex: DQException[]) => new Set(ex.map((e) => e.recordId));
  const activeIds = records.map((r) => r.id).filter((id) => !rec.merged.includes(id));
  const initiallyFailing = idsWith(exceptions);
  // After reconciliation only surviving (non-merged) records are assessed.
  const stillFailing = new Set([...idsWith(remaining)].filter((id) => activeIds.includes(id)));
  const manualExceptions = remaining.filter((e) => activeIds.includes(e.recordId));

  const kpis = {
    rawRecords: records.length,
    uniqueProducts: activeIds.length,
    duplicatesMerged: rec.merged.length,
    duplicateIdentifiers: prof.duplicateBarcodes.length,
    validInitially: records.length - initiallyFailing.size,
    recordsWithExceptions: initiallyFailing.size,
    totalExceptions: exceptions.length,
    autoCorrected: rec.corrections.length,
    pricingDiscrepancies: new Set(exceptions.filter((e) => e.type === "Pricing discrepancy").map((e) => e.recordId)).size,
    manualReview: stillFailing.size,
    manualExceptions: manualExceptions.length,
    validAfter: activeIds.length - stillFailing.size,
    weeklyMarginOverstatement: round2(rec.costEffects.filter((c) => c.weekly > 0).reduce((a, c) => a + c.weekly, 0)),
    weeklyMarginUnderstatement: round2(-rec.costEffects.filter((c) => c.weekly < 0).reduce((a, c) => a + c.weekly, 0)),
  };
  const byType = Object.entries(
    exceptions.reduce<Record<string, number>>((acc, e) => ({ ...acc, [e.type]: (acc[e.type] ?? 0) + 1 }), {}),
  ).sort((a, b) => b[1] - a[1]);

  return { profile: prof, standardised: std, groups, validation, exceptions, reconciliation: rec, revalidation, remaining, manualExceptions, activeIds, kpis, byType };
}

export type PipelineResult = ReturnType<typeof runPipeline>;
