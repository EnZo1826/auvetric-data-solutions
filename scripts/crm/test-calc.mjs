// Unit tests for CRM money/date maths (run: npm run crm:test:calc). Part of `npm run check`.
import assert from 'node:assert/strict';
import { addDays, computeTotals, endOfMonth, formatDate, formatDocNumber, formatMoney, lineAmount, toCents, todayISO, toNad, uid } from '../../src/crm/shared/calc.ts';

// ── cents robustness ──
assert.equal(toCents(0.1 + 0.2), 30);
assert.equal(toCents(1.005), 101, 'binary 1.00499… still rounds to 101 cents');
assert.equal(toCents('12.34'), 1234);
assert.equal(toCents(undefined), 0);
assert.equal(lineAmount({ qty: 3, rate: 0.1 }), 0.3);
assert.equal(lineAmount({ qty: 1.5, rate: 850 }), 1275);
assert.equal(lineAmount({ qty: 0.333, rate: 3 }), 1);

// ── totals: VAT on the document total, half-up, then discount (JobTracker rule) ──
const lines = [{ qty: 1, rate: 0.05 }, { qty: 1, rate: 0.05 }, { qty: 1, rate: 0.05 }];
// per-line VAT would be 3 × round(0.75c) = 3c; on the total it's round(2.25c) = 2c
assert.deepEqual(computeTotals(lines, 15, 0), { subtotal: 0.15, vat: 0.02, discount: 0, total: 0.17 });
assert.deepEqual(computeTotals([{ qty: 10, rate: 850 }, { qty: 2, rate: 1250.5 }], 15, 100), { subtotal: 11001, vat: 1650.15, discount: 100, total: 12551.15 });
assert.deepEqual(computeTotals([{ qty: 1, rate: 0.1 }], 15, 0).vat, 0.02, '1.5c rounds half-up to 2c');
assert.deepEqual(computeTotals([{ qty: 7, rate: 999.99 }], 0, 0), { subtotal: 6999.93, vat: 0, discount: 0, total: 6999.93 }, 'not VAT-registered');
assert.deepEqual(computeTotals([], 15, 0), { subtotal: 0, vat: 0, discount: 0, total: 0 });

// ── formatting ──
assert.equal(formatMoney(1234567.891, 'NAD'), 'N$ 1,234,567.89');
assert.equal(formatMoney(-5, 'USD'), '-US$ 5.00');
assert.equal(formatDate('2026-10-18'), '18 Oct 2026');
assert.equal(formatDate(''), '');
assert.equal(formatDocNumber('AUV-INV-{YYYY}-', 7, 4, '2026-03-01'), 'AUV-INV-2026-0007');
assert.equal(formatDocNumber('Q{YY}/', 12345, 4, '2027-01-01'), 'Q27/12345');

// ── dates (Windhoek, UTC+2, no DST) ──
assert.equal(todayISO(new Date('2026-12-31T21:59:00Z')), '2026-12-31');
assert.equal(todayISO(new Date('2026-12-31T22:00:00Z')), '2027-01-01', 'midnight in Windhoek is 22:00 UTC');
assert.equal(addDays('2026-02-20', 14), '2026-03-06');
assert.equal(addDays('2028-02-28', 1), '2028-02-29');
assert.equal(endOfMonth('2026-02-10'), '2026-02-28');

// ── currency conversion ──
assert.equal(toNad(100, 'NAD', null), 100);
assert.equal(toNad(1000, 'USD', 18.4567), 18456.7);
assert.equal(toNad(10, 'USD', null), 0, 'missing rate never invents a value');

assert.match(uid(), /^[0-9a-f]{16}$/);
assert.notEqual(uid(), uid());
console.log('CRM calc units: cents, VAT on total (half-up), discount, formatting, numbering, Windhoek dates, NAD conversion passed.');
