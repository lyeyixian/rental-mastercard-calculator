# Keep state and secrets in-repo under `local/`

Per-machine state (`local/state.json`) and secrets (`local/.env`, holding Telegram bot token and chat ID) live inside the repo rather than under `~/`. The whole `local/` directory is gitignored at the directory level (not file-by-file); `local/.env.example` is committed as a setup template. This keeps everything related to the project in one place and makes the "private" convention visible to any future reader at a glance.

## Considered Options

- **`~/.rental-secrets` + `~/.rental-state.json` (the v2 plan's original choice)** — Rejected. Stronger separation and survives `rm -rf` of the repo, but scatters project-related files across `$HOME` for a personal one-laptop project where that resilience has no practical payoff.
- **macOS Keychain for secrets** — Rejected. The Telegram bot token's worst case is the bot spamming the user's own chat. Keychain adds CLI complexity and occasional unlock prompts for negligible benefit at that blast radius.
- **`EnvironmentVariables` block in the launchd plist** — Rejected. Manual `npm start` from a terminal would not pick them up unless also exported in the shell, forcing two credential-load code paths.
- **In-repo `local/` with directory-level gitignore** — Chosen.

## Consequences

- The `local/` entry in `.gitignore` is load-bearing. A future change that scatters state or secret files outside `local/` loses the safeguard and exposes them to `git add .` accidents.
- Re-cloning the repo loses both state and secrets. Recovery: re-paste bot token + chat ID into `local/.env`; lose dedup state for at most the current month (worst case: a duplicated Telegram message if re-cloning after the Reminder Date).
