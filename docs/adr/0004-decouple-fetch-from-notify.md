# Decouple rate fetch from notification via a state file

v2 sends a Telegram reminder on the Reminder Date with the Transfer Amount. The fragile operation (Mastercard rate fetch — Akamai might block on any given day) and the user-facing operation (Telegram push) are split into two scheduled jobs that communicate via a JSON state file at `local/state.json`. This gives the fetch a 13-day window (the 2nd through the 15th) to succeed across many login attempts, so an Akamai block on the Reminder Date itself cannot silently kill the reminder.

## Considered Options

- **Single job on the Reminder Date** — Rejected. An Akamai block on the one day the reminder needs to fire produces no reminder, which is the exact failure mode v2 exists to prevent. The "I don't have to think about rent" goal collapses if a silent failure means the user has to remember after all.
- **Decoupled fetch + notify via state file** — Chosen. Fetch runs login-triggered from the 2nd of the month with self-dedup (no-op once the rate for the current month is cached). Notify runs at 8pm on the 15th, reads the cached rate, and posts to Telegram. State file records `month`, `rate`, `transferAmount`, `fetchedAt`, `notifiedAt`.

## Consequences

- The state file becomes load-bearing infrastructure between two launchd plists. Its schema cannot be trivially changed without coordinated edits to both scripts.
- The two jobs each self-deduplicate via the state file — fetch skips if the current month's rate is present, notify skips if `notifiedAt` is set for the current month.
- A separate Telegram warning fires on the 10th if no rate has been cached by then, so silent fetch failure surfaces before the Reminder Date instead of as a missing reminder.
- This extends ADR-0002 (local headed browser, previously assumed manual trigger). The login-triggered fetch with self-dedup *before* Chromium opens preserves ADR-0002's "occasional brief popup" property — empirically the popup fires ≤1× per month, not on every login.
