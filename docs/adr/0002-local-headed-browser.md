# Run locally as a headed browser, triggered manually each month

Mastercard's converter is protected by Akamai Bot Manager, which aggressively blocks vanilla headless Playwright — empirically, the page loads but no real form elements render and a direct API call returns no usable data. We chose to run a *headed* Chromium browser on the user's laptop, triggered manually on or after the 1st of each month, rather than building a headless or cloud-scheduled pipeline.

## Considered Options

- **Cloud cron (GitHub Actions, cloud VM)** — Rejected. Datacenter IPs are blocked by Akamai by default; would require a paid residential proxy plus a stealth library, for the sake of skipping a 30-second human action once a month.
- **Headless local with stealth library** (`patchright`, `playwright-extra` + stealth plugin, `camoufox`) — Rejected for v1. Adds a dependency and an arms race against Akamai for marginal benefit. Can revisit if headed mode stops working.
- **Paid browser farm** (Browserless, Scrapfly) — Rejected. Recurring cost for a once-a-month task is hard to justify.
- **Headed local, manual trigger** — Chosen. Residential IP + real OS + visible Chromium has the strongest signal of "real user" and the smallest engineering surface. The user is already making a manual bank transfer afterwards, so a manual script trigger is free.

## Consequences

- The script will not run unattended. Any future move to scheduled execution (cron, launchd, cloud) requires this design to be revisited.
- If Akamai escalates its detection of headed Chromium, the script will fail and the fallback path is to add a stealth library.
- A visible Chromium window pops up on the user's desktop briefly each run; acceptable for a once-a-month task.
