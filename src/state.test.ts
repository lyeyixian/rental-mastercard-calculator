import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createStateStore } from './state';

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
  store.writeFetchResult({
    month: '2026-06',
    rate: '0.3238726',
    transferAmount: 950.42,
    fetchedAt: '2026-06-02T08:14:00+08:00',
  });
  const state = store.readState();
  assert.equal(state?.month === '2026-06', true);
  assert.equal(state?.month === '2026-07', false);
});

test('writeFetchResult then readState returns the written struct with notifiedAt null', () => {
  const store = createStateStore(freshTempStateFile());
  store.writeFetchResult({
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

test('writeNotifiedAt throws when input month does not match existing state month', () => {
  const store = createStateStore(freshTempStateFile());
  store.writeFetchResult({
    month: '2026-06',
    rate: '0.3238726',
    transferAmount: 950.42,
    fetchedAt: '2026-06-02T08:14:00+08:00',
  });
  assert.throws(
    () =>
      store.writeNotifiedAt({
        month: '2026-07',
        notifiedAt: '2026-07-15T20:00:00+08:00',
      }),
    /month mismatch/i,
  );
});

test('writeNotifiedAt preserves rate, transferAmount, fetchedAt from prior writeFetchResult', () => {
  const store = createStateStore(freshTempStateFile());
  store.writeFetchResult({
    month: '2026-06',
    rate: '0.3238726',
    transferAmount: 950.42,
    fetchedAt: '2026-06-02T08:14:00+08:00',
  });
  store.writeNotifiedAt({
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
