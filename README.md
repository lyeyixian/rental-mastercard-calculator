# rental-mastercard-calculator

A Node.js/TypeScript script that computes the **Transfer Amount** to send to the landlord's DBS account each month for a Malaysian rent payment, using the **Mastercard FX Rate** for the **Transaction Date** (the 1st of the current month).

It fetches the rate, subtracts the agreed **Deduction**, prints the result, and copies the **Transfer Amount** to the clipboard so it can be pasted straight into DBS.

For the precise definitions of these terms, see [`CONTEXT.md`](./CONTEXT.md).

## How it works

Mastercard's converter is protected by Akamai Bot Manager, which blocks vanilla headless requests. So the script:

1. Opens a **visible** Chromium window via Playwright and waits briefly until the converter page has settled (enough to acquire valid Akamai session cookies).
2. Calls Mastercard's `conversion-rates` JSON API **directly** from that browser context — it does not fill in the converter form.
3. Reads `crdhldBillAmt` (Mastercard's pre-multiplied SGD figure) from the response, subtracts the **Deduction**, and prints / copies the result.

The rationale for each of these choices lives in the ADRs:

- [`docs/adr/0001-use-mastercard-fx-rate.md`](./docs/adr/0001-use-mastercard-fx-rate.md) — why Mastercard specifically (the rate source is part of the rental agreement).
- [`docs/adr/0002-local-headed-browser.md`](./docs/adr/0002-local-headed-browser.md) — why a visible local browser, not headless or cloud-scheduled.
- [`docs/adr/0003-skip-form-use-api-directly.md`](./docs/adr/0003-skip-form-use-api-directly.md) — why we call the JSON API directly instead of driving the React form.

## Requirements

- [Node.js](https://nodejs.org/) ≥ 20.12 (uses the built-in `process.loadEnvFile()`)
- [pnpm](https://pnpm.io/) ≥ 11 (`brew install pnpm`, or see [pnpm.io/installation](https://pnpm.io/installation))

## Setup

```bash
pnpm install
pnpm exec playwright install chromium   # explicit: pnpm doesn't run Playwright's postinstall by default
```

pnpm is used instead of npm to harden the install path against npm-registry supply-chain attacks — see [ADR-0008](./docs/adr/0008-adopt-pnpm.md).

## Usage

```bash
# Fetch the Mastercard FX Rate, compute the Transfer Amount, copy it to the clipboard.
pnpm start

# Run the unit tests on the pure modules (date, parseResponse, computeTransfer).
pnpm test
```

On a successful run, the script prints the Transaction Date, the Mastercard FX Rate, and the Transfer Amount, and (on macOS) puts the Transfer Amount on the clipboard ready to paste into DBS.

## Setting up Telegram

The Telegram path delivers the autonomous reminder on the **Reminder Date**. To wire it up:

1. **Create a bot.** In Telegram, open a chat with [@BotFather](https://t.me/BotFather) and run `/newbot`. Follow the prompts (display name, then a username ending in `bot`). BotFather replies with an HTTP API token — keep this around for step 3.
2. **Find your chat ID.** Open a chat with your new bot and send it any message (e.g. "hi"). Then in a browser, visit `https://api.telegram.org/bot<TOKEN>/getUpdates`, replacing `<TOKEN>` with the token from step 1. The response is JSON; read `result[0].message.chat.id` — that's your `TELEGRAM_CHAT_ID`.
3. **Populate `local/.env`.**
   ```bash
   cp local/.env.example local/.env
   # edit local/.env and fill in TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID
   chmod 600 local/.env
   ```
   Treat the bot token as a password. Worst case if leaked: a stranger can spam your own chat with the bot — limited blast radius, but still worth locking down.

The reminder itself is delivered by the notify agent on its scheduled evenings (see "Running autonomously with launchd" below); there is no separate placeholder-message step.

### Testing the reminder on demand

`pnpm notify` only acts on the scheduled days (a warning on the 10th–14th, the reminder on the 15th), and prints `Nothing to send today.` otherwise. To exercise the full decision → render → **real Telegram send** on any date, set `NOTIFY_TEST_DATE`:

```bash
NOTIFY_TEST_DATE=2026-07-15 pnpm notify   # reminder branch (needs a cached rate for that month)
NOTIFY_TEST_DATE=2026-07-12 pnpm notify   # warning branch
```

`NOTIFY_TEST_DATE` runs in **test mode**: it sends a real message so you can confirm your bot token and chat ID work, but it deliberately **skips the state write**, so a test run never sets `notifiedAt` and can't suppress the genuine scheduled reminder. The value must be a real `YYYY-MM-DD` calendar date — a malformed or impossible date (e.g. `2026-02-30`) exits with an error rather than guessing.

## Running autonomously with launchd

The fully autonomous flow — fetch the rate from the 2nd of the month, daily at 19:00 (and on login), and deliver a Telegram reminder at 8pm on the 15th — is driven by two macOS `launchd` LaunchAgents whose templates live in [`launchd/`](./launchd):

- **`com.lyeyixian.rental-fetch.plist`** — `RunAtLoad=true` plus `StartCalendarInterval` at 19:00 daily. Fires once per day (and on login); the fetch script's date guard and state-file dedup make all firings after the first successful fetch of the month effectively a no-op. See [ADR-0007](./docs/adr/0007-fetch-daily-calendar-trigger.md) for why daily rather than login-only.
- **`com.lyeyixian.rental-notify.plist`** — `StartCalendarInterval` for day=10, 11, 12, 13, 14, 15 at hour=20. The notify state machine decides what (if anything) to send each evening.

Both plists redirect stdout and stderr to `local/fetch.log` and `local/notify.log`, which the directory-level `local/` gitignore already covers.

### Quick install

`scripts/install-launchd.sh` renders both templates with this machine's paths, copies them into `~/Library/LaunchAgents/`, and `launchctl load`s them. Re-running is safe — already-loaded agents are unloaded first. Pair with `scripts/uninstall-launchd.sh` to tear everything down.

```bash
scripts/install-launchd.sh --dry-run   # preview the rendered plists; touch nothing
scripts/install-launchd.sh             # install + load
scripts/uninstall-launchd.sh           # unload + remove
```

The script auto-detects pnpm's absolute path and the directory holding `node`, wiring the former into the plist's `ProgramArguments` and the latter into its `PATH`. Override with `PNPM_BIN=...` (pnpm's path) or `LAUNCHD_PATH=...` (the agent `PATH`) if a detected value is wrong for your setup (e.g. `LAUNCHD_PATH="/opt/homebrew/bin:/usr/bin:/bin"`).

If you'd rather see exactly what goes into `~/Library/LaunchAgents/`, the manual procedure below is the same set of steps spelled out by hand.

### Install (manual)

The plist templates contain three placeholder tokens you replace with your own paths:

- `__REPO_PATH__` — absolute path to this repo checkout (e.g. `/Users/yourname/Documents/repo/rental-mastercard-calculator`).
- `__PNPM__` — absolute path to the `pnpm` binary (find it with `command -v pnpm`; on Apple Silicon this is typically `/opt/homebrew/bin/pnpm`, on Intel `/usr/local/bin/pnpm`). launchd needs an absolute path here — unlike a shell, it doesn't search `PATH` to resolve the command name.
- `__PATH__` — the `PATH` the agent should inherit. Must include the directory holding `node` (pnpm shells out to it). On Apple Silicon with Homebrew, typically `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin`.

```bash
# Copy the templates into your LaunchAgents directory.
cp launchd/com.lyeyixian.rental-fetch.plist ~/Library/LaunchAgents/
cp launchd/com.lyeyixian.rental-notify.plist ~/Library/LaunchAgents/

# Edit both copies — replace __REPO_PATH__, __PNPM__, and __PATH__ with real values.
$EDITOR ~/Library/LaunchAgents/com.lyeyixian.rental-fetch.plist
$EDITOR ~/Library/LaunchAgents/com.lyeyixian.rental-notify.plist

# Load both agents.
launchctl load ~/Library/LaunchAgents/com.lyeyixian.rental-fetch.plist
launchctl load ~/Library/LaunchAgents/com.lyeyixian.rental-notify.plist
```

The fetch agent runs immediately on `load` (because of `RunAtLoad`) and then daily at 19:00 thereafter. The notify agent waits for its next calendar slot.

### Verify

```bash
# Both agents should be listed.
launchctl list | grep lyeyixian

# The fetch run on `load` (or the next 19:00, or the next login) appends to
# local/fetch.log — either an actual fetch summary or silent dedup output.
cat local/fetch.log

# Notify entries appear after the first 20:00 calendar slot fires (10th–15th).
cat local/notify.log
```

For an end-to-end smoke test of the fetch pipeline, either log out and log back in (`RunAtLoad`) or wait for the next 19:00 with the laptop awake: `local/fetch.log` should record the next invocation.

### Uninstall

```bash
launchctl unload ~/Library/LaunchAgents/com.lyeyixian.rental-fetch.plist
launchctl unload ~/Library/LaunchAgents/com.lyeyixian.rental-notify.plist
rm ~/Library/LaunchAgents/com.lyeyixian.rental-fetch.plist
rm ~/Library/LaunchAgents/com.lyeyixian.rental-notify.plist
```

`pnpm start` and `pnpm run notify` continue to work after uninstall — the launchd integration is purely a scheduler layer on top of the same scripts.

## Configuration

All knobs live in [`src/config.ts`](./src/config.ts):

| Field               | Default | Meaning |
|---------------------|---------|---------|
| `fromCurrency`      | `MYR`   | Currency of the **MYR Rent** (source of the conversion). |
| `amount`            | `2950`  | The **MYR Rent** — the fixed monthly amount agreed with the landlord. |
| `toCurrency`        | `SGD`   | Target currency (what gets transferred). |
| `bankFee`           | `0`     | The Mastercard `bank_fee` query parameter — a card-issuer markup the API can model. Always `0` because we want the raw rate. **This is not the landlord Deduction** — see below. |
| `deductionSgd`      | `5`     | The **Deduction**: a flat SGD amount the landlord absorbs, subtracted from the SGD-equivalent rent to produce the **Transfer Amount**. Nothing to do with Mastercard. |
| `url`               | Mastercard converter URL | The page Playwright opens to acquire Akamai cookies. |
| `readinessSelector` | `#calculate-button` | A selector the script waits for before calling the API — proves the page rendered and cookies are valid. |

The Transaction Date is not configurable; it is always computed as the 1st of the current calendar month.

### "Bank fee" ambiguity

`bankFee` (the Mastercard API query parameter) and the **Deduction** are unrelated. The bare phrase "bank fee" is avoided throughout the codebase and docs; see the "Flagged ambiguities" section in [`CONTEXT.md`](./CONTEXT.md).

## Platform note (clipboard)

The clipboard step shells out to `pbcopy`, which is **macOS-only**. On Linux or Windows the spawn fails silently and the script still prints the Transfer Amount to stdout — copy it manually from there.

## Failure modes

- **`Timed out waiting for #calculate-button. Akamai likely blocked the request — please retry.`** — The converter page never rendered the readiness selector within the timeout. Usually transient; just run `pnpm start` again. If it keeps happening, Akamai may have escalated detection of headed Chromium (see ADR-0002 for the fallback path).
- **`parseRateResponse: <reason>. raw=<json>`** — Mastercard's API returned a 200 but the JSON didn't match the expected shape (see ADR-0003 for the recorded schema). The raw response is included in the error message for debugging; the schema in ADR-0003 is the starting point for re-detection.
- **`HTTP <status>`** — The API call itself failed. Retry; if it persists, check `url` and whether Mastercard has changed the endpoint.
