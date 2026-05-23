import { test } from 'node:test';
import assert from 'node:assert/strict';

import { computeTransferAmount } from './computeTransfer';

test('computeTransferAmount: happy path subtracts Deduction and rounds to 2 d.p.', () => {
  assert.equal(computeTransferAmount(955.4241700, 5), 950.42);
});

test('computeTransferAmount: half-up rounding boundary', () => {
  assert.equal(computeTransferAmount(874.085, 5), 869.09);
});

test('computeTransferAmount: zero Deduction returns input unchanged (rounded)', () => {
  assert.equal(computeTransferAmount(100, 0), 100);
});

test('computeTransferAmount: exact 2-d.p. input', () => {
  assert.equal(computeTransferAmount(100.00, 5), 95);
});
