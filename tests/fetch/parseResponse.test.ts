import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseRateResponse } from '../../src/fetch/parseResponse';

const validRaw = {
  conversionRate: '0.3238726',
  crdhldBillAmt: '955.4241700',
  crdhldBillCurr: 'SGD',
  fxDate: '2026-02-01',
  transAmt: '2950',
  transCurr: 'MYR',
};

test('parseRateResponse: happy path returns parsed rate and crdhldBillAmt', () => {
  const result = parseRateResponse(validRaw, '2026-02-01', 2950);
  assert.deepEqual(result, {
    rate: 0.3238726,
    crdhldBillAmt: 955.4241700,
  });
});

test('parseRateResponse: throws when raw is not an object (null)', () => {
  assert.throws(() => parseRateResponse(null, '2026-02-01', 2950), /not an object/i);
});

test('parseRateResponse: throws when raw is not an object (string)', () => {
  assert.throws(() => parseRateResponse('oops', '2026-02-01', 2950), /not an object/i);
});

test('parseRateResponse: throws naming crdhldBillAmt when missing', () => {
  const { crdhldBillAmt: _missing, ...rest } = validRaw;
  assert.throws(
    () => parseRateResponse(rest, '2026-02-01', 2950),
    /crdhldBillAmt/,
  );
});

test('parseRateResponse: throws on fxDate mismatch naming the mismatch', () => {
  assert.throws(
    () => parseRateResponse(validRaw, '2026-03-01', 2950),
    /fxDate mismatch/,
  );
});

test('parseRateResponse: throws on transAmt mismatch naming the mismatch', () => {
  assert.throws(
    () => parseRateResponse(validRaw, '2026-02-01', 3000),
    /transAmt mismatch/,
  );
});

test('parseRateResponse: throws when crdhldBillAmt is non-numeric ("abc")', () => {
  assert.throws(
    () => parseRateResponse({ ...validRaw, crdhldBillAmt: 'abc' }, '2026-02-01', 2950),
    /crdhldBillAmt/,
  );
});

test('parseRateResponse: throws when crdhldBillAmt is zero', () => {
  assert.throws(
    () => parseRateResponse({ ...validRaw, crdhldBillAmt: '0' }, '2026-02-01', 2950),
    /crdhldBillAmt/,
  );
});

test('parseRateResponse: throws when crdhldBillAmt is negative', () => {
  assert.throws(
    () => parseRateResponse({ ...validRaw, crdhldBillAmt: '-5' }, '2026-02-01', 2950),
    /crdhldBillAmt/,
  );
});

test('parseRateResponse: every error message includes raw response stringified', () => {
  const cases: Array<{ raw: unknown; date: string; amount: number }> = [
    { raw: null, date: '2026-02-01', amount: 2950 },
    { raw: 'oops', date: '2026-02-01', amount: 2950 },
    { raw: { ...validRaw, crdhldBillAmt: undefined }, date: '2026-02-01', amount: 2950 },
    { raw: validRaw, date: '2026-03-01', amount: 2950 },
    { raw: validRaw, date: '2026-02-01', amount: 3000 },
    { raw: { ...validRaw, crdhldBillAmt: 'abc' }, date: '2026-02-01', amount: 2950 },
    { raw: { ...validRaw, crdhldBillAmt: '0' }, date: '2026-02-01', amount: 2950 },
    { raw: { ...validRaw, crdhldBillAmt: '-5' }, date: '2026-02-01', amount: 2950 },
  ];
  for (const { raw, date, amount } of cases) {
    assert.throws(
      () => parseRateResponse(raw, date, amount),
      (err: Error) => err.message.includes(JSON.stringify(raw)),
      `error message did not include raw=${JSON.stringify(raw)}`,
    );
  }
});
