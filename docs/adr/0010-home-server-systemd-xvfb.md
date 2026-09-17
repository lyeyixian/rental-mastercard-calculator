# Move the scheduler to a Linux home server: systemd timers plus Xvfb

Both agents ran on a laptop under launchd. That tied the schedule to the laptop being awake at 19:00 and 20:00, and the July 2026 TCC incident (ADR-0009) showed how much of the launchd setup was macOS-specific workaround rather than scheduling. An always-on Linux box on the same home network was available, so the schedule moved there on 2026-09-17.

The fetch and notify scripts are unchanged. What changed is the layer around them: four systemd user units under `systemd/` replace the two LaunchAgents, and the fetch service runs under `xvfb-run` so Playwright's headed Chromium has a display to draw into. The units are symlinked straight out of the checkout by `scripts/install-systemd.sh`, and output goes to journald.

## What stays from earlier decisions

- **ADR-0002, headed browser on a residential IP.** Still holds. The server sits behind the same home router as the laptop, so Akamai sees the same IP, and Xvfb gives Chromium a real X display, so `headless: false` stays as is. Nothing in the stealth-library fallback was needed.
- **ADR-0004 and ADR-0007, decoupled fetch with a daily trigger.** Carried over one to one. `rental-fetch.timer` fires every day at 19:00 and `rental-notify.timer` at 20:00 on the 10th through 15th, the same wall-clock schedule as the plists. `Persistent=true` replays a slot missed while the box was off, which is the closest systemd gets to launchd firing a missed `StartCalendarInterval` on wake.
- **ADR-0005, state and secrets under `local/`.** Unchanged. The cutover copied `local/.env` and `local/state.json` over by scp, with `.env` set to mode 600.

## What no longer applies

- **ADR-0009, logs outside TCC folders.** There is no TCC on Linux and no log file to open before spawn. The services write to journald, and `journalctl --user -u rental-fetch` replaces `cat ~/Library/Logs/rental-fetch.log`. The ADR stays on record for anyone who reinstalls the launchd agents.
- **`RunAtLoad`.** systemd timers have no equivalent. `Persistent=true` only replays a run once a last-trigger stamp exists, so a fresh install does not fetch until the next 19:00. The install script prints `systemctl --user start rental-fetch.service` as the manual first run.

## Considered Options

- **systemd user timers, units symlinked from the repo.** Chosen. The scheduler the OS already runs, no extra daemon, and journald for free. Symlinking rather than copying means a `git pull` and `daemon-reload` picks up unit edits with no rendering step. Cost: the units hardcode the checkout at `~/repo/rental-mastercard-calculator` and assume nvm, which the install script checks up front.
- **Render placeholders into copies under `~/.config/systemd/user/`, mirroring the launchd installer.** Rejected. That was the plan going in. It exists on macOS because launchd needs an absolute path to `pnpm` and a hand-built `PATH`. On the server node and pnpm come from nvm, and sourcing `nvm.sh` inside the `ExecStart` puts both on `PATH` and follows nvm's default alias across upgrades. With that, the only path left to render was the home directory, and the `%h` specifier covers it.
- **Cron with `xvfb-run`.** Rejected. Works, but no journal, no `Persistent` catch-up after downtime, and no `list-timers` to see what fires next.
- **Headless Chromium with a stealth library on the server.** Rejected, same reasoning as ADR-0002. Xvfb removes the reason to reopen that arms race: the browser is still headed, it just draws to a framebuffer nobody looks at.
- **Stay on the laptop.** Rejected. The schedule depended on the laptop being awake at the right minute, and ADR-0007's sleep-and-catch-up behaviour still left a reminder at the mercy of whether the lid was open on the 15th.

## Evidence

The spike (ENG-49) and cutover (ENG-50 to ENG-52) recorded the following on the server, an Ubuntu 26.04.1 host with systemd 259, xvfb 21.1.22, node v24.21.0 and pnpm 12.4.2 via nvm, timezone Asia/Singapore.

- **2026-09-16, spike.** `xvfb-run -a pnpm start` run by hand fetched the Mastercard FX Rate for 2026-09 and wrote it to `local/state.json`. The rate, 0.316468, matched what the laptop had fetched on 2026-09-02, so Akamai served the server the same answer it served the laptop. One run, not the three or four days the spike ticket asked for. The first scheduled fetch of October is the next data point.
- **2026-09-17, first run under systemd.** `systemctl --user start rental-fetch.service` after install exited 0 in two seconds, logging `Rate for 2026-09 already cached`. That exercises the whole unit path with no terminal attached: bash sourcing `nvm.sh`, `xvfb-run`, `pnpm --silent start`, journald capture. It does not exercise a live fetch, because the month was already cached.
- **2026-09-17, cutover.** `list-timers` showed `rental-fetch.timer` next firing Fri 2026-09-18 19:00 +08 and `rental-notify.timer` Sat 2026-10-10 20:00 +08. `scripts/uninstall-launchd.sh` ran on the laptop and `launchctl list | grep lyeyixian` printed nothing. Lingering was enabled for the user so the timers survive logout.

## Consequences

- The laptop is no longer in the loop. `pnpm start` and `pnpm run notify` still work there for manual use, and the launchd templates and installer stay in the repo, but only one machine may run the notify agent at a time or the Telegram reminder is sent twice.
- The Chromium popup from ADR-0002 is gone from the desktop. It now opens on an Xvfb display on the server, at most once a month, and nobody sees it.
- `scripts/install-systemd.sh` turns on lingering when it is off. `scripts/uninstall-systemd.sh` leaves it on, since other user services on the box may depend on it.
- The units assume the repo lives at `~/repo/rental-mastercard-calculator` and that `~/.nvm/nvm.sh` exists. Moving the checkout or switching away from nvm means editing `WorkingDirectory` and `ExecStart` in both services.
- The README's launchd section describes the macOS path. A systemd section beside it describes this one. The clipboard note already says the `pbcopy` step never runs under either scheduler because stdout is not a TTY.
- Open question until October: whether Akamai stays happy with Chromium on Xvfb over many runs. If the fetch starts failing from the server while the laptop still succeeds, the ADR-0002 fallback, a stealth library, is the next step.
