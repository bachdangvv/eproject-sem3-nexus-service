import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { computeAdvanceQuote, computeBillAmounts, getBulkDiscountPercent } from '../src/data/tariffs.ts';

// Independent expected deposits are shared with the API smoke suite.
const cases = JSON.parse(readFileSync(new URL('../../docs/fixtures/bulk-discount-cases.json', import.meta.url), 'utf8'));
const prices = { B: 225, D: 50, T: 125 };
const deposits = { B: 500, D: 325, T: 250 };

function estimate(type, count, includeSecurityDeposit = true, extra = {}) {
  return computeBillAmounts({
    connectionType: type,
    planRentalUsd: prices[type],
    connectionCount: count,
    includeSecurityDeposit,
    usageChargesUsd: 0,
    equipmentReplacementUsd: 0,
    previousArrearsUsd: 0,
    ...extra,
  });
}

for (const fixture of cases) {
  for (const type of Object.keys(prices)) {
    test(`${type}: ${fixture.count} lines discount the deposit, with full rental in both periods`, () => {
      const first = estimate(type, fixture.count);
      const next = estimate(type, fixture.count, false);
      const rental = prices[type] * fixture.count;
      assert.equal(getBulkDiscountPercent(fixture.count), fixture.percent);
      assert.equal(first.discountPercent, fixture.percent);
      assert.equal(first.netDepositUsd, fixture.deposit[type]);
      assert.equal(first.bulkDiscountAmountUsd, deposits[type] * fixture.count - fixture.deposit[type]);
      assert.equal(first.rentalTotalUsd, rental);
      assert.equal(first.taxableServicesUsd, rental);
      assert.equal(next.taxableServicesUsd, rental);
      assert.equal(next.netDepositUsd, 0);
      assert.equal(next.bulkDiscountAmountUsd, 0);
      assert.equal(next.discountPercent, 0);
    });
  }
}

test('10 Broadband lines: $2,250 rental + $275.40 tax + $3,750 deposit', () => {
  assert.equal(estimate('B', 10).totalEstimatedUsd, 6275.40);
  assert.equal(estimate('B', 10).serviceInvoiceTotalUsd, 2525.40);
  assert.equal(estimate('B', 10, false).totalEstimatedUsd, 2525.40);
});

test('51 Broadband lines waive the deposit while rental remains $11,475', () => {
  const result = estimate('B', 51);
  assert.equal(result.rentalTotalUsd, 11475);
  assert.equal(result.serviceTaxUsd, 1404.54);
  assert.equal(result.totalEstimatedUsd, 12879.54);
});

test('bulk eligibility never discounts usage, equipment or carried debt', () => {
  const result = estimate('T', 15, true, {
    usageChargesUsd: 14.50,
    equipmentReplacementUsd: 10.25,
    previousArrearsUsd: 100,
  });
  assert.equal(result.taxableServicesUsd, 1899.75);
  assert.equal(result.serviceTaxUsd, 232.53);
  assert.equal(result.netDepositUsd, 1875);
  assert.equal(result.totalEstimatedUsd, 4107.28);
});

for (const fixture of cases) {
  test(`advance quote at 100 per line: ${fixture.count} lines`, () => {
    const quote = computeAdvanceQuote(100, fixture.count);
    assert.equal(quote.quotedAmount, fixture.advanceAt100);
    assert.equal(quote.discountPercent, fixture.percent);
  });
}

test('advance distinguishes unconfigured, explicit zero and a 100% waiver', () => {
  assert.equal(computeAdvanceQuote(null, 10).status, 'NotConfigured');
  assert.equal(computeAdvanceQuote(0, 10).status, 'NotRequired');
  assert.equal(computeAdvanceQuote(100, 51).status, 'Waived');
});

test('advance is a payment timing quote, never added to service charges or combined cost', () => {
  const withAdvance = estimate('B', 10, true, { advancePerConnection: 100 });
  assert.equal(withAdvance.advanceQuote.quotedAmount, 750);
  assert.equal(withAdvance.serviceInvoiceTotalUsd, 2525.40);
  assert.equal(withAdvance.totalEstimatedUsd, 6275.40);
  assert.equal(withAdvance.totalEstimatedUsd, estimate('B', 10).totalEstimatedUsd);
});
