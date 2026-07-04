import { test } from 'node:test';
import assert from 'node:assert/strict';

import { decideNotifyAction } from '../../src/notify/notifyDecision';
import { State } from '../../src/shared/state';

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

test('today on the 10th + rate cached for current month → noop (no warning when fetch already succeeded)', () => {
  const today = new Date(2026, 5, 10); // 2026-06-10
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

test('today on the 15th + previously sent late-no-rate (rate null, notifiedAt set) → noop (idempotent)', () => {
  const today = new Date(2026, 5, 15);
  const lateNoRateMarker: State = {
    month: '2026-06',
    rate: null,
    transferAmount: null,
    fetchedAt: null,
    notifiedAt: '2026-06-15T20:00:00+08:00',
  };
  assert.deepEqual(decideNotifyAction(today, lateNoRateMarker), {
    kind: 'noop',
  });
});

test('today on the 10th + no rate cached (state null) → sendWarning with month and 5 days until the Reminder Date', () => {
  const today = new Date(2026, 5, 10); // 2026-06-10
  assert.deepEqual(decideNotifyAction(today, null), {
    kind: 'sendWarning',
    month: '2026-06',
    daysUntilReminder: 5,
  });
});

test('today on the 14th + no rate cached → sendWarning with 1 day until the Reminder Date', () => {
  const today = new Date(2026, 5, 14); // 2026-06-14
  assert.deepEqual(decideNotifyAction(today, null), {
    kind: 'sendWarning',
    month: '2026-06',
    daysUntilReminder: 1,
  });
});

test('today on the 15th + no rate cached (state null) → sendLateNoRate with current month', () => {
  const today = new Date(2026, 5, 15); // 2026-06-15
  assert.deepEqual(decideNotifyAction(today, null), {
    kind: 'sendLateNoRate',
    month: '2026-06',
  });
});

test('today on the 15th + state cached for a different month → treated as no rate cached → sendLateNoRate', () => {
  const today = new Date(2026, 5, 15); // 2026-06-15
  const staleMayState: State = {
    month: '2026-05',
    rate: '0.3199999',
    transferAmount: 944.0,
    fetchedAt: '2026-05-02T08:14:00+08:00',
    notifiedAt: null,
  };
  assert.deepEqual(decideNotifyAction(today, staleMayState), {
    kind: 'sendLateNoRate',
    month: '2026-06',
  });
});

test('today on the 12th + state cached for a different month → treated as no rate cached → sendWarning', () => {
  const today = new Date(2026, 5, 12); // 2026-06-12
  const staleMayState: State = {
    month: '2026-05',
    rate: '0.3199999',
    transferAmount: 944.0,
    fetchedAt: '2026-05-02T08:14:00+08:00',
    notifiedAt: null,
  };
  assert.deepEqual(decideNotifyAction(today, staleMayState), {
    kind: 'sendWarning',
    month: '2026-06',
    daysUntilReminder: 3,
  });
});
