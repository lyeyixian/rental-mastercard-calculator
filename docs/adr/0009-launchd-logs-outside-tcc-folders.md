# launchd agent logs live outside the TCC-protected folders

The two LaunchAgents originally pointed `StandardOutPath`/`StandardErrorPath` at `local/fetch.log` and `local/notify.log` inside the repo. When the repo checkout sits under `~/Documents` (the typical location), this broke silently after the macOS 26.5.2 update (July 2026): every scheduled run died with `EX_CONFIG` (exit 78) and an empty log, so the July rent reminder never reached Telegram and nothing anywhere said why.

The mechanism: launchd opens the agent's `StandardOutPath` **before** spawning the job, and macOS privacy protection (TCC) mediates that open against the service's program binary. `pnpm` — an unsigned Homebrew script — holds no Files-and-Folders grant for `~/Documents`, so the open is denied, launchd aborts the spawn as a configuration error, and no process ever runs to log anything. The failure is invisible by construction: the log stays empty because the log file itself is the thing being denied. (Diagnosed empirically: an otherwise-identical plist with its log in `/tmp` ran cleanly; Apple's own `/bin/ls` as the program could open a Documents log where `pnpm` could not.)

The logs therefore move to `~/Library/Logs/rental-fetch.log` and `~/Library/Logs/rental-notify.log`, via a `__LOG_DIR__` template token that `scripts/install-launchd.sh` resolves (default `~/Library/Logs`, overridable with `LOG_DIR=...`). The install script refuses a `LOG_DIR` under `~/Documents`, `~/Desktop`, or `~/Downloads` so the silent failure mode cannot be reintroduced by configuration.

## Considered Options

- **Move the logs to `~/Library/Logs`** — Chosen. The macOS-conventional home for per-user agent logs, never TCC-protected, no extra privileges required, and no dependence on any particular binary holding a privacy grant. Cost: logs are no longer co-located with the repo.
- **Keep logs in the repo, invoke `node` directly instead of `pnpm`** — Rejected. Worked in testing (this machine's `node` holds a user-approved Documents grant), but the fix rides on a TCC grant tied to one binary at one nvm-versioned path; a node upgrade or a grant reset by a future macOS update silently recreates the failure.
- **Keep logs in the repo, grant `pnpm` Full Disk Access** — Rejected. Files-and-Folders can't be granted manually (the pre-spawn denial never shows a prompt), so FDA is the only route — a whole-disk privilege for a log file, keyed to a Homebrew Cellar path that changes on every `brew upgrade pnpm`.
- **Move the repo out of `~/Documents`** — Rejected. Sidesteps TCC entirely, but relocating the checkout is a bigger disruption than relocating two log files, and other machines would each need the same convention.

## Consequences

- `scripts/install-launchd.sh` gains a `LOG_DIR` override, creates the directory, and fails fast on TCC-protected values. Already-installed agents must be reinstalled (`scripts/install-launchd.sh`) to pick up the new paths.
- The runtime's own file I/O is unaffected: `local/state.json` and `local/.env` stay in the repo. Those are read/written by the spawned `node` process, not by launchd pre-spawn — node prompts for (or already holds) Documents access the first time. Only launchd's pre-spawn log open is structurally unable to ask.
- The `local/` gitignore still covers any stray logs, but nothing writes there anymore under launchd.
- Debugging note for the future: `launchctl list` showing status `78` with an empty/absent log is the signature of this class of failure — check where the plist's log paths (and `WorkingDirectory`) point before suspecting the scripts.
