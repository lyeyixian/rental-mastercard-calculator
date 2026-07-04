import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createStateStore } from '../../src/shared/state';

function freshTempStateFile(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rmc-state-'));
  return path.join(dir, 'state.json');
}

test('readState returns null when state file does not exist', () => {
  const store = createStateStore(freshTempStateFile());
  assert.equal(store.readState(), null);
});

test('readState lets caller dedup by month: month matches written month, mismatches another', () => {
  const store = createStateStore(freshTempStateFile());
  store.apply({
    kind: 'rateFetched',
    month: '2026-06',
    rate: '0.3238726',
    transferAmount: 950.42,
    fetchedAt: '2026-06-02T08:14:00+08:00',
  });
  const state = store.readState();
  assert.equal(state?.month === '2026-06', true);
  assert.equal(state?.month === '2026-07', false);
});

test('apply(rateFetched) then readState returns the written struct with notifiedAt null', () => {
  const store = createStateStore(freshTempStateFile());
  store.apply({
    kind: 'rateFetched',
    month: '2026-06',
    rate: '0.3238726',
    transferAmount: 950.42,
    fetchedAt: '2026-06-02T08:14:00+08:00',
  });
  assert.deepEqual(store.readState(), {
    month: '2026-06',
    rate: '0.3238726',
    transferAmount: 950.42,
    fetchedAt: '2026-06-02T08:14:00+08:00',
    notifiedAt: null,
  });
});

test('apply(reminderSent) throws when event month does not match existing state month', () => {
  const store = createStateStore(freshTempStateFile());
  store.apply({
    kind: 'rateFetched',
    month: '2026-06',
    rate: '0.3238726',
    transferAmount: 950.42,
    fetchedAt: '2026-06-02T08:14:00+08:00',
  });
  assert.throws(
    () =>
      store.apply({
        kind: 'reminderSent',
        month: '2026-07',
        notifiedAt: '2026-07-15T20:00:00+08:00',
      }),
    /month mismatch/i,
  );
});

test('apply(reminderSent) preserves rate, transferAmount, fetchedAt from prior apply(rateFetched)', () => {
  const store = createStateStore(freshTempStateFile());
  store.apply({
    kind: 'rateFetched',
    month: '2026-06',
    rate: '0.3238726',
    transferAmount: 950.42,
    fetchedAt: '2026-06-02T08:14:00+08:00',
  });
  store.apply({
    kind: 'reminderSent',
    month: '2026-06',
    notifiedAt: '2026-06-15T20:00:00+08:00',
  });
  assert.deepEqual(store.readState(), {
    month: '2026-06',
    rate: '0.3238726',
    transferAmount: 950.42,
    fetchedAt: '2026-06-02T08:14:00+08:00',
    notifiedAt: '2026-06-15T20:00:00+08:00',
  });
});

test('apply(lateNoRateSent) records notifiedAt for a month that never saw a fetch (rate fields null)', () => {
  const store = createStateStore(freshTempStateFile());
  store.apply({
    kind: 'lateNoRateSent',
    month: '2026-06',
    notifiedAt: '2026-06-15T20:00:00+08:00',
  });
  assert.deepEqual(store.readState(), {
    month: '2026-06',
    rate: null,
    transferAmount: null,
    fetchedAt: null,
    notifiedAt: '2026-06-15T20:00:00+08:00',
  });
});

test('apply(lateNoRateSent) overwrites a stale-month state (different month, no migration)', () => {
  const store = createStateStore(freshTempStateFile());
  store.apply({
    kind: 'rateFetched',
    month: '2026-05',
    rate: '0.3199999',
    transferAmount: 944.0,
    fetchedAt: '2026-05-02T08:14:00+08:00',
  });
  store.apply({
    kind: 'lateNoRateSent',
    month: '2026-06',
    notifiedAt: '2026-06-15T20:00:00+08:00',
  });
  // The June late-no-rate marker fully replaces the stale May record.
  assert.deepEqual(store.readState(), {
    month: '2026-06',
    rate: null,
    transferAmount: null,
    fetchedAt: null,
    notifiedAt: '2026-06-15T20:00:00+08:00',
  });
});
