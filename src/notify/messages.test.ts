import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  escapeMarkdownV2,
  formatLateNoRateMessage,
  formatReminderMessage,
  formatWarningMessage,
} from './messages';

const sampleReminder = {
  monthName: 'June 2026',
  transactionDate: '2026-06-01',
  rate: '0.3238726',
  myrRent: 2950,
  deductionSgd: 5,
  transferAmount: '950.42',
};

test('escapeMarkdownV2 prefixes every MarkdownV2 reserved character with a backslash', () => {
  const reserved = '_*[]()~`>#+-=|{}.!';
  for (const ch of reserved) {
    assert.equal(
      escapeMarkdownV2(ch),
      `\\${ch}`,
      `expected '${ch}' to be escaped to '\\${ch}'`,
    );
  }
});

test('formatReminderMessage wraps Transfer Amount in backticks for tap-to-copy', () => {
  const out = formatReminderMessage(sampleReminder);
  assert.match(out, /`950\.42`/);
});

test('formatReminderMessage renders Mastercard FX Rate outside backticks with literal "." escaped', () => {
  const out = formatReminderMessage(sampleReminder);
  // Rate must appear outside backtick spans with `.` escaped per MarkdownV2.
  const outsideBackticks = stripBacktickSpans(out);
  assert.ok(
    outsideBackticks.includes('0\\.3238726'),
    `expected outside-backticks text to contain '0\\.3238726', got: ${outsideBackticks}`,
  );
});

test('formatReminderMessage renders month name, Transaction Date, and the rent/deduction breakdown', () => {
  const out = formatReminderMessage(sampleReminder);
  const outsideBackticks = stripBacktickSpans(out);
  // Month name verbatim (no MarkdownV2 specials in "June 2026").
  assert.ok(
    outsideBackticks.includes('June 2026'),
    `expected output to contain 'June 2026', got: ${outsideBackticks}`,
  );
  // Transaction Date with literal '-' escaped per MarkdownV2.
  assert.ok(
    outsideBackticks.includes('2026\\-06\\-01'),
    `expected output to contain '2026\\-06\\-01', got: ${outsideBackticks}`,
  );
  // MYR Rent and Deduction numeric values.
  assert.ok(
    outsideBackticks.includes('2950'),
    `expected output to contain '2950', got: ${outsideBackticks}`,
  );
  assert.ok(
    outsideBackticks.includes('5'),
    `expected output to contain '5' (Deduction), got: ${outsideBackticks}`,
  );
});

test('formatLateNoRateMessage names the month and instructs the user to compute manually via Mastercard', () => {
  const out = formatLateNoRateMessage({ monthName: 'June 2026' });
  assert.ok(
    out.includes('June 2026'),
    `expected output to mention month, got: ${out}`,
  );
  assert.match(
    out,
    /[Mm]astercard/,
    'expected output to reference Mastercard (the agreed source for the rate)',
  );
});

test('formatLateNoRateMessage escapes literal "." in the body so MarkdownV2 parses cleanly', () => {
  const out = formatLateNoRateMessage({ monthName: 'June 2026' });
  // Every '.' that appears in literal text (outside emphasis/code spans) must
  // be backslash-escaped per MarkdownV2 — otherwise Telegram returns 400.
  assertNoUnescapedReservedChars(out);
});

test('formatWarningMessage interpolates the day count and month name', () => {
  const out = formatWarningMessage({
    monthName: 'June 2026',
    daysUntilReminder: 5,
  });
  assert.ok(
    out.includes('June 2026'),
    `expected output to mention month, got: ${out}`,
  );
  assert.match(
    out,
    /\b5\b/,
    `expected output to contain the day count '5', got: ${out}`,
  );
});

test('formatWarningMessage produces valid MarkdownV2 with all interpolated and literal reserved chars escaped', () => {
  const out = formatWarningMessage({
    monthName: 'June 2026',
    daysUntilReminder: 5,
  });
  assertNoUnescapedReservedChars(out);
});

test('formatWarningMessage renders a different day-count when called with daysUntilReminder=1', () => {
  // Regression: previously the day count was hard-coded or dropped on the floor.
  const out = formatWarningMessage({
    monthName: 'June 2026',
    daysUntilReminder: 1,
  });
  assert.match(
    out,
    /\b1\b/,
    `expected output to contain the day count '1', got: ${out}`,
  );
  assert.ok(
    !/\b5\b/.test(out),
    `expected day count to actually vary; found '5' when caller passed 1: ${out}`,
  );
});

function stripBacktickSpans(text: string): string {
  return text.replace(/`[^`]*`/g, '');
}

function assertNoUnescapedReservedChars(text: string): void {
  // Strip backtick code spans (content inside need not be escaped).
  const withoutCodeSpans = text.replace(/`[^`]*`/g, '');
  // Strip *...* bold emphasis spans (the * markers are intentional MarkdownV2).
  const withoutEmphasis = withoutCodeSpans.replace(/\*[^*\n]+\*/g, '');
  // Any reserved char remaining outside spans must be backslash-escaped.
  const unescaped = withoutEmphasis.match(/(?<!\\)[_*[\]()~`>#+\-=|{}.!]/g);
  assert.equal(
    unescaped,
    null,
    `expected no unescaped MarkdownV2 reserved chars, found: ${unescaped?.join(', ')} in: ${JSON.stringify(withoutEmphasis)}`,
  );
}
