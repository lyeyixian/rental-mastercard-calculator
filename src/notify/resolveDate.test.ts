import { test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveDate } from './resolveDate';

const FALLBACK = new Date(2026, 6, 4, 9, 30); // 2026-07-04 09:30 local

test('a valid YYYY-MM-DD override becomes local midnight of that day in test mode', () => {
  const { date, testMode } = resolveDate('2026-07-15', FALLBACK);
  assert.equal(testMode, true);
  assert.equal(date.getFullYear(), 2026);
  assert.equal(date.getMonth(), 6);
  assert.equal(date.getDate(), 15);
  assert.equal(date.getHours(), 0);
  assert.equal(date.getMinutes(), 0);
});

test('no override uses the fallback clock and stays out of test mode', () => {
  const { date, testMode } = resolveDate(undefined, FALLBACK);
  assert.equal(testMode, false);
  assert.equal(date, FALLBACK);
});

test('a malformed override is rejected with a NOTIFY_TEST_DATE error', () => {
  for (const bad of ['not-a-date', '2026-7-5', '07-15-2026', '2026/07/15']) {
    assert.throws(
      () => resolveDate(bad, FALLBACK),
      /NOTIFY_TEST_DATE/,
      `expected "${bad}" to be rejected`,
    );
  }
});

test('a well-formed but impossible calendar date is rejected, not rolled over', () => {
  for (const bad of ['2026-02-30', '2026-13-01', '2026-00-10']) {
    assert.throws(
      () => resolveDate(bad, FALLBACK),
      /NOTIFY_TEST_DATE/,
      `expected "${bad}" to be rejected`,
    );
  }
});
