import { test } from 'node:test';
import assert from 'node:assert/strict';

import { formatDate, getFirstDayOfCurrentMonth } from './date';

test('formatDate zero-pads single-digit month', () => {
  assert.equal(formatDate(new Date(2026, 0, 1)), '2026-01-01');
});

test('formatDate zero-pads single-digit day for December', () => {
  assert.equal(formatDate(new Date(2026, 11, 9)), '2026-12-09');
});

test('getFirstDayOfCurrentMonth returns day 1 of the month containing now', () => {
  const result = getFirstDayOfCurrentMonth(new Date(2026, 4, 23));
  assert.equal(result.getFullYear(), 2026);
  assert.equal(result.getMonth(), 4);
  assert.equal(result.getDate(), 1);
});
