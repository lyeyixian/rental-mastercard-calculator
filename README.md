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

The reminder itself is delivered by the notify agent on its scheduled evenings (see "Running autonomously with systemd" below); there is no separate placeholder-message step.

### Testing the reminder on demand

`pnpm notify` only acts on the scheduled days (a warning on the 10th–14th, the reminder on the 15th), and prints `Nothing to send today.` otherwise. To exercise the full decision → render → **real Telegram send** on any date, set `NOTIFY_TEST_DATE`:

```bash
NOTIFY_TEST_DATE=2026-07-15 pnpm notify   # reminder branch (needs a cached rate for that month)
NOTIFY_TEST_DATE=2026-07-12 pnpm notify   # warning branch
```

`NOTIFY_TEST_DATE` runs in **test mode**: it sends a real message so you can confirm your bot token and chat ID work, but it deliberately **skips the state write**, so a test run never sets `notifiedAt` and can't suppress the genuine scheduled reminder. The value must be a real `YYYY-MM-DD` calendar date — a malformed or impossible date (e.g. `2026-02-30`) exits with an error rather than guessing.

## Running autonomously with systemd

The fully autonomous flow, fetch the rate from the 2nd of the month daily at 19:00 and deliver a Telegram reminder at 20:00 on the 15th, runs as four systemd user units under [`systemd/`](./systemd) on a Linux home server. It replaced a pair of macOS launchd agents in September 2026 ([ADR-0010](./docs/adr/0010-home-server-systemd-xvfb.md)). The launchd files were removed once the cutover settled. ADR-0007 and ADR-0009 describe that era. The scheduler is a layer on top of `pnpm start` and `pnpm run notify`, which keep working by hand anywhere.

- **`rental-fetch.service`** and **`rental-fetch.timer`**: `OnCalendar=*-*-* 19:00:00`, daily. The service runs `xvfb-run -a pnpm --silent start`, so Playwright's headed Chromium gets a virtual X display and [ADR-0002](./docs/adr/0002-local-headed-browser.md) still holds on a box with no desktop.
- **`rental-notify.service`** and **`rental-notify.timer`**: `OnCalendar=*-*-10..15 20:00:00`. Runs `pnpm --silent run notify`.

Both timers set `Persistent=true`, so a slot missed while the machine was off fires as soon as it is back. A fresh install does not fetch until the next 19:00 unless you start the service by hand (below). The fetch script's date guard and state-file dedup make every firing after the first successful fetch of the month a no-op, so firing daily costs nothing ([ADR-0007](./docs/adr/0007-fetch-daily-calendar-trigger.md)).

Output goes to journald, not to log files.

### Assumptions baked into the units

The units are symlinked straight out of the checkout rather than rendered and copied, so there are no placeholders to fill in. In exchange they assume two things, and `scripts/install-systemd.sh` refuses to run if either is false:

- The checkout lives at `~/repo/rental-mastercard-calculator` (`WorkingDirectory=%h/repo/rental-mastercard-calculator`).
- `node` and `pnpm` come from [nvm](https://github.com/nvm-sh/nvm). Each `ExecStart` runs through `bash -c 'source ~/.nvm/nvm.sh && exec ...'`, because systemd resolves bare commands against a fixed search path and nvm only adds its `bin` directory when `nvm.sh` is sourced. Sourcing it also follows nvm's default alias, so a node upgrade needs no unit edit.

If your server differs, edit `WorkingDirectory` and `ExecStart` in both service files and the `EXPECTED_PATH` check in the install script.

### Server prerequisites

On top of the [Requirements](#requirements) above:

```bash
pnpm exec playwright install --with-deps chromium   # pulls the Linux shared libs Chromium needs
sudo apt install xvfb                                # provides /usr/bin/xvfb-run
sudo timedatectl set-timezone Asia/Singapore         # the schedules are wall-clock; check with `date`
```

Then copy the gitignored state and secrets over from wherever the agents ran before ([ADR-0005](./docs/adr/0005-state-and-secrets-in-repo.md)), and lock down the secrets file:

```bash
scp local/.env local/state.json user@server:~/repo/rental-mastercard-calculator/local/
ssh user@server chmod 600 ~/repo/rental-mastercard-calculator/local/.env
```

### Install

```bash
scripts/install-systemd.sh     # link units, enable + restart both timers, enable lingering
scripts/uninstall-systemd.sh   # disable timers, unlink all four units
```

Only one machine may run the notify agent at a time, or the Telegram reminder goes out twice. Uninstall on the old host before installing on the new one.

The install script links the two services, enables the two timers, and restarts the timers so an edited `OnCalendar=` takes effect on re-run. It also runs `loginctl enable-linger` for you if lingering is off. Without lingering the user manager, and every timer in it, stops when your last session ends, so the jobs would die the moment you close SSH. Uninstall leaves lingering on because other user services may depend on it; `loginctl disable-linger "$USER"` turns it off.

Because the units are symlinks, editing one and running `systemctl --user daemon-reload` is enough to pick up the change. A changed timer schedule also needs `systemctl --user restart rental-fetch.timer` (or re-run the install script, which does that).

### Verify

```bash
# Both timers with their next fire time.
systemctl --user list-timers 'rental-*'

# Run the fetch now instead of waiting for 19:00. Safe to repeat: the script
# no-ops once the month is cached.
systemctl --user start rental-fetch.service

# Every run logs one outcome line (fetched, already cached, or skipped on the 1st).
journalctl --user -u rental-fetch --since today
journalctl --user -u rental-notify --since today

# Follow both live.
journalctl --user -u rental-fetch -u rental-notify -f
```

To confirm the Telegram token and chat ID work from the server, use `NOTIFY_TEST_DATE` with a date in a month that has no entry in `local/state.json`. A date in the current month prints `noop` once the month's rate is cached or `notifiedAt` is set, because test mode only skips the state write, it does not ignore existing state.

```bash
NOTIFY_TEST_DATE=2026-10-12 pnpm notify   # warning branch, sends a real message, writes nothing
```

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

The clipboard step shells out to `pbcopy`, which is **macOS-only**. Two things keep it from mattering anywhere else:

- `copyToClipboard` returns early when stdout is not a TTY, so under systemd it never runs at all. The Telegram reminder carries the Transfer Amount instead.
- On an interactive Linux or Windows shell the `pbcopy` spawn error is swallowed and the script still prints the Transfer Amount to stdout. Copy it manually from there.

## Failure modes

- **`Timed out waiting for #calculate-button. Akamai likely blocked the request — please retry.`** — The converter page never rendered the readiness selector within the timeout. Usually transient; just run `pnpm start` again. If it keeps happening, Akamai may have escalated detection of headed Chromium (see ADR-0002 for the fallback path).
- **`parseRateResponse: <reason>. raw=<json>`** — Mastercard's API returned a 200 but the JSON didn't match the expected shape (see ADR-0003 for the recorded schema). The raw response is included in the error message for debugging; the schema in ADR-0003 is the starting point for re-detection.
- **`HTTP <status>`** — The API call itself failed. Retry; if it persists, check `url` and whether Mastercard has changed the endpoint.
