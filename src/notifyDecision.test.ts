import { test } from 'node:test';
import assert from 'node:assert/strict';

import { decideNotifyAction } from './notifyDecision';
import { State } from './state';

const cachedJune: State = {
  month: '2026-06',
  rate: '0.3238726',
  transferAmount: 950.42,
  fetchedAt: '2026-06-02T08:14:00+08:00',
  notifiedAt: null,
};

test('today before the 15th → noop even when rate is cached', () => {
  const today = new Date(2026, 5, 14); // 2026-06-14
  assert.deepEqual(decideNotifyAction(today, cachedJune), { kind: 'noop' });
});

test('today on the 15th + rate cached for current month + not yet notified → sendReminder with the state', () => {
  const today = new Date(2026, 5, 15); // 2026-06-15
  assert.deepEqual(decideNotifyAction(today, cachedJune), {
    kind: 'sendReminder',
    state: cachedJune,
  });
});

test('today on the 15th + already notified for current month → noop (idempotent)', () => {
  const today = new Date(2026, 5, 15);
  const alreadyNotified: State = {
    ...cachedJune,
    notifiedAt: '2026-06-15T20:00:00+08:00',
  };
  assert.deepEqual(decideNotifyAction(today, alreadyNotified), { kind: 'noop' });
});

test('today on the 15th + no rate cached (state null) → noop (late-no-rate handled in slice 4)', () => {
  const today = new Date(2026, 5, 15);
  assert.deepEqual(decideNotifyAction(today, null), { kind: 'noop' });
});

test('today on the 15th + state cached for a different month → treated as no rate cached → noop', () => {
  const today = new Date(2026, 5, 15); // 2026-06-15
  const staleMayState: State = {
    month: '2026-05',
    rate: '0.3199999',
    transferAmount: 944.0,
    fetchedAt: '2026-05-02T08:14:00+08:00',
    notifiedAt: null,
  };
  assert.deepEqual(decideNotifyAction(today, staleMayState), { kind: 'noop' });
});
