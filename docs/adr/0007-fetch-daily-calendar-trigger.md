# Fetch trigger: daily calendar interval, not login event

ADR-0004 specified a login-triggered fetch with self-dedup, on the assumption that the user logs in frequently enough during the 2nd–15th window for at least one attempt to succeed. That assumption did not hold for the actual usage pattern: lock + unlock keeps the same session alive for weeks at a time, so `RunAtLoad` never re-fires after install. The fetch effectively only ran once — on install day — and then never again, which defeats ADR-0004's "13-day window across many attempts" rationale.

The fetch trigger is changed to a daily `StartCalendarInterval` at 19:00, kept alongside the existing `RunAtLoad=true`. `RunAtLoad` covers the install-day fetch and any incidental logins; the daily 19:00 firing covers the steady state regardless of whether the user ever logs out.

## Considered Options

- **Daily `StartCalendarInterval` at 19:00, keep `RunAtLoad=true`** — Chosen. launchd fires at 19:00 every day the per-user agent is loaded; if the laptop is asleep at the trigger, the missed slot fires on next wake. Daily firing gives ≥1 attempt per day across the 2nd–15th window, matching ADR-0004's "many attempts" intent. 19:00 sits 1 hour before notify's 20:00 — the buffer is tight on the Reminder Date itself, but the broader 14-day window means a single 19:00 Akamai block is not catastrophic.
- **Event-based trigger on screen unlock or wake-from-sleep** — Rejected. launchd has no first-class trigger for either; achieving it needs a sleepwatcher-style auxiliary daemon or `WatchPaths` hacks against system files. Adds a brittle moving part for no clear win over a wall-clock trigger.
- **Periodic `StartInterval` every N hours** — Rejected. Less predictable than calendar firing; launchd coalesces missed intervals into a single catch-up rather than re-firing at a consistent time. No advantage over `StartCalendarInterval` for this job.
- **Explicit `Day` entries for the 2nd–15th** — Rejected in favour of firing every day at 19:00. The script's date guard already silent-exits on the 1st, and state.json dedup silent-exits on already-fetched days, so firing year-round costs ~351 no-op runs/year (milliseconds each). Single source of truth for the window lives in the script, not duplicated in the plist.

## Consequences

- The Chromium popup characteristic from ADR-0002 shifts: the ≤1×/month popup now happens at ~19:00 instead of at login. Frequency is unchanged because the script's pre-Chromium dedup is unchanged.
- The fetch is no longer coupled to user behaviour. The script attempts a fetch even if the user never logs out for months — as long as the laptop is awake at 19:00 or wakes after the missed slot.
- ADR-0004's decouple-via-state-file decision is unaffected; only the launchd trigger mechanism is superseded.
