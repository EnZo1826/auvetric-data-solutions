// Verifies that every figure shown in the Data Integrity demo is reproducible from the bundled
// synthetic dataset. Expected values below were derived by hand from src/lib/integrity.ts data.
// Run: npm run verify:data   (requires Node >= 22.6 for TypeScript type stripping)
import assert from "node:assert/strict";
import { runPipeline, rawRecords, isValidEan13 } from "../src/lib/integrity.ts";

const r = runPipeline(rawRecords);
const k = r.kpis;

assert.equal(k.rawRecords, 18, "raw records");
assert.equal(k.duplicateIdentifiers, 3, "barcodes shared by >1 record (R01/R02, R05/R06, R07/R11)");
assert.equal(k.duplicatesMerged, 2, "true duplicates merged (R02, R06)");
assert.equal(k.uniqueProducts, 16, "products after merge");
assert.equal(k.recordsWithExceptions, 11, "raw records failing at least one rule");
assert.equal(k.validInitially, 7, "raw records passing every rule");
assert.equal(k.totalExceptions, 15, "rule failures before reconciliation");
assert.equal(k.autoCorrected, 5, "authority-based corrections (R03 pack+cost, R04 cost, R16 pack+cost)");
assert.equal(k.pricingDiscrepancies, 4, "records with pricing discrepancies (R05, R06, R10, R16)");
assert.equal(k.manualReview, 7, "surviving products needing manual review");
assert.equal(k.manualExceptions, 8, "open exceptions after reconciliation");
assert.equal(k.validAfter, 9, "valid products after reconciliation");
assert.equal(k.weeklyMarginOverstatement, 6643.3, "R03 19.83×310 + R04 0.80×620");
assert.equal(k.weeklyMarginUnderstatement, 6270, "R16 19.00×330");
assert.equal(r.profile.invalidBarcodes.join(), "R12");
assert.ok(rawRecords.filter((x) => x.id !== "R12").every((x) => isValidEan13(x.barcode)));
assert.deepEqual(r.reconciliation.merged, ["R02", "R06"]);

console.log("Data integrity demo: all", Object.keys(k).length, "KPIs reproduced from the synthetic dataset.");
console.table(k);
