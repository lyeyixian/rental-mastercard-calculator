import { test } from 'node:test';
import assert from 'node:assert/strict';

import { escapeMarkdownV2, formatReminderMessage } from './messages';

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

function stripBacktickSpans(text: string): string {
  return text.replace(/`[^`]*`/g, '');
}
