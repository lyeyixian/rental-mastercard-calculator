# v2 plan — Telegram reminder on the 15th

_Drafted 2026-05-23. Status: design, not yet implemented. Resume after v1 ships and has run successfully for at least one rent cycle._

## Goal

Free up the mental capacity currently spent remembering "rent is on the 15th." Instead, receive a Telegram message on the 15th of each month with the SGD Transfer Amount, computed from the Mastercard FX rate for the 1st of that same month.

The user opens the message, reads the number, makes the transfer in the DBS app. No script invocation needed; no calendar reminder needed.

## What's settled

### Reminder day, not rate day

- **Rate date** is still the 1st of the current month (unchanged from v1).
- **Reminder date** is the 15th of the current month (the rent payment day).
- The two are decoupled and run as separate jobs (see "Architecture" below).

### Architecture: decoupled fetch + notify, daemon-style

The fragile operation (rate fetch — Akamai might block) and the user-facing operation (Telegram push — basically can't fail) run as **separate scheduled jobs** with a JSON state file between them.

```
fetch job          notify job
   │                  │
   ▼                  ▼
~/.rental-state.json  (read by notify, written by fetch)
```

**Why decoupled:** if we did both in one job on the 15th, an Akamai block on that specific day would silently kill the whole flow — defeating the "I don't have to think about it" goal. With decoupling, the fetch has from the 2nd until the 15th to succeed (13 days of retry window), and the notify is reading a file + one HTTPS POST.

### State file schema

`~/.rental-state.json` — outside the repo, per-machine, not committed.

```json
{
  "month": "2026-06",
  "rate": "0.3238726",
  "transferAmount": 950.42,
  "fetchedAt": "2026-06-02T08:14:00+08:00",
  "notifiedAt": "2026-06-15T09:00:00+08:00"
}
```

Both jobs self-deduplicate via this file: fetch exits silently if `month` matches and `rate` is present; notify exits silently if `notifiedAt` is set for the current `month`.

### Telegram bot is push-only

- Register a bot once with `@BotFather`, get the token.
- Find the user's chat ID (one-shot manual step — message the bot, then `getUpdates`).
- The script just POSTs to `https://api.telegram.org/bot<TOKEN>/sendMessage`.
- **No bot hosting needed.** The Telegram side requires nothing long-running. The local-residential-IP constraint (from ADR-0002) is about the *rate fetch*, not the Telegram bot.

### Where it runs

Same as v1: local laptop, residential IP. Required for Akamai. Cloud cron / GitHub Actions are still off the table — extends ADR-0002 unchanged.

## What's still open (resume here)

### 1. Fetch trigger timing

Four options were considered, none committed:

- **(A)** Daily at 6am while user is asleep. Requires laptop awake/`pmset`. Lowest visible disruption.
- **(B)** ⭐ _Recommended._ On first login each day from the 2nd, until rate is cached. Window pops up during morning coffee. Self-recovering across "laptop was off for a week."
- **(C)** Hourly from the 2nd. Too aggressive, will interrupt meetings.
- **(D)** On wake-from-sleep. Fires too often.

**Sticking point:** option (B) means a brief headed Chromium window pops up sometime around login. Acceptable trade-off, or does that push us toward stealth-headless instead (next item)?

### 2. Headed vs stealth-headless — revisit ADR-0002?

In v1 the user manually triggers, so the visible Chromium window is *expected*. In v2 the daemon decides when to fetch — possibly during a meeting or focus session.

- **Stay headed** (current ADR-0002): zero new dependencies, proven against Akamai for residential IPs. Cost: occasional brief window pop.
- **Switch to stealth-headless** (`patchright`, `playwright-extra` + stealth, or `camoufox`): no visible window ever. Cost: new dependency, ongoing arms race against Akamai, slightly worse reliability.

**Decision deferred to v2 build time.** If option (B) feels fine in practice during a few v1 manual runs, stay headed. If the morning popup is annoying enough to matter, switch.

### 3. Notify time on the 15th

Probably 9am local. Should the notify job also have a `RunAtLoad` clause so that if the laptop is asleep at 9am, it fires on next wake? Likely yes — same catch-up principle as the fetch job.

### 4. Telegram message content

Probably:

```
Rent due — May 2026

Transfer SGD 950.42 to landlord (DBS).

Rate: 1 MYR = 0.3239 SGD (2026-05-01)
MYR 2,950 − Deduction 5 SGD
```

But this is bikeshed-able. Pin down at build time.

### 5. Failure-mode notifications

If the fetch job has been failing for N days and the 15th is approaching, should the daemon push a Telegram message warning the user to investigate? Otherwise the failure mode is "no message arrives on the 15th, user wonders why."

Probably yes — push a warning if `fetchedAt` is missing for the current month by, say, the 10th.

### 6. Telegram credentials storage

`~/.rental-secrets.json` or env vars in the launchd plist's `EnvironmentVariables` block. Either is fine. Don't commit either form. Add a `.env.example` to the repo as a setup guide.

### 7. Manual override

`npm start` should still work as a manual run for ad-hoc fetches (e.g., for testing, or if the user wants to check the rate mid-month). The manual run should still print to console and `pbcopy` the result, but should *also* update the state file — so a manual run can satisfy the month's fetch and the autonomous daemon will silently skip from then on.

### 8. Clipboard in autonomous mode

When the daemon runs the fetch unattended, `pbcopy` is meaningless. The script should detect "am I being run interactively or autonomously?" and skip clipboard in the autonomous case. (Easy: check `process.stdout.isTTY` or pass a `--quiet` flag from the launchd plist.)

## ADRs to write when v2 is implemented

- **ADR-0004 (likely):** "Decouple rate fetch from notification using a state file." Hard to reverse (state file becomes load-bearing), surprising without context (a reader sees two launchd jobs and wonders why), real trade-off vs the simpler single-job design.
- **Possibly ADR-0005:** "Use Telegram for delivery" — but only if there's a real trade-off recorded (we considered email / Slack / iMessage / Apple Notes and rejected them for specific reasons). If "Telegram because the user has it" is the whole story, no ADR.
- **Possibly update ADR-0002:** if v2 forces a switch to stealth-headless, mark ADR-0002 as superseded.

## Resume checklist

When picking this back up:

1. Confirm v1 has run successfully for at least one rent cycle and the API endpoint / response shape match ADR-0003 still.
2. Revisit "still open" items 1–2 with current information.
3. Build, then write the ADR(s).
