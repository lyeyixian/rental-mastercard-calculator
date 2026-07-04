export interface ResolvedDate {
  date: Date;
  testMode: boolean;
}

// Test hook: `NOTIFY_TEST_DATE=YYYY-MM-DD pnpm notify` drives the real
// decision, render, and Telegram send against a synthetic date. `override` is
// the raw NOTIFY_TEST_DATE value; `fallback` is the real clock for normal runs.
export function resolveDate(
  override: string | undefined,
  fallback: Date,
): ResolvedDate {
  if (!override) {
    return { date: fallback, testMode: false };
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(override.trim());
  if (!match) {
    throw new Error(
      `Invalid NOTIFY_TEST_DATE="${override}". Expected YYYY-MM-DD (e.g. 2026-07-15).`,
    );
  }

  const [, year, month, day] = match;
  // Local midnight, matching the local getFullYear/getMonth/getDate the
  // decision logic reads via src/shared/date.ts.
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  // JS rolls impossible dates over (Feb 30 -> Mar 2); reject if the
  // components didn't round-trip.
  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day)
  ) {
    throw new Error(
      `Invalid NOTIFY_TEST_DATE="${override}". Not a real calendar date.`,
    );
  }
  return { date, testMode: true };
}
