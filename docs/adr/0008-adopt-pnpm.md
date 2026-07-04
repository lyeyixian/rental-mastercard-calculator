# Adopt pnpm as the package manager

The project moves from npm to pnpm to harden the dependency-install path against the npm-registry supply-chain attacks of late 2025 (Shai-Hulud and Shai-Hulud 2.0, Sept–Dec 2025). Those attacks work through two vectors: a compromised package's `postinstall` lifecycle script running on install, and a freshly-published malicious version being pulled in the hours before it is caught and unpublished. pnpm 11's defaults neutralise both — it does not run dependency build/lifecycle scripts unless they are explicitly approved, and its `minimumReleaseAge` defaults to 1 day, so an install never picks up a version younger than 24 hours.

The package **source** is unchanged — pnpm installs from the same npm registry. The win is entirely in install-time policy, not in where packages come from. pnpm's strict, non-flat `node_modules` is a secondary benefit: a compromised transitive dependency can only reach packages that actually declared it, rather than the whole project via npm's flat phantom-hoisting.

## Considered Options

- **pnpm** — Chosen. Safe-by-default on both vectors (scripts off, `minimumReleaseAge=1440` on by default in v11), smallest blast radius from the strict dependency tree, and a near drop-in for npm (`pnpm import` converts the existing lockfile). Cost: build scripts are opt-in, so Playwright's browser download becomes an explicit step (see Consequences).
- **Harden npm in place** (`min-release-age` + `ignore-scripts` in `.npmrc`) — Rejected. npm 11 supports both defenses, but they are opt-in and easy to forget, and npm keeps the large flat-hoist blast radius. pnpm makes the safe choices the defaults.
- **Bun** — Rejected. Faster, but runs lifecycle scripts by default (no edge on the primary vector) and is a whole-runtime bet rather than a package-manager swap.
- **Deno** — Rejected. The most secure model, but a different runtime — effectively a rewrite, not a swap.

## Consequences

- pnpm is bootstrapped via Homebrew (`brew install pnpm`), which owns the installed version. corepack is no longer bundled with Node 26, and Homebrew avoids both a global npm install and a piped-`curl` installer. The `packageManager` field is deliberately *not* used: its consumers (corepack, CI/PaaS auto-detection) do not apply to this local-only project, and an exact pin would only drift from the brew-managed binary. The requirement is instead recorded as a loose `engines` constraint (`node >=20.12`, `pnpm >=11`) — advisory documentation that matches the README without pinning a patch version.
- Playwright's `postinstall` browser download no longer runs automatically — `pnpm exec playwright install chromium` is an explicit setup step. It already was in the README, so setup is unchanged in practice; this is the intended trade for scripts-off-by-default.
- Playwright is floored at `^1.61.1` (≥ 1.60.0 required). Under Node 24.16+/26.x, Playwright ≤ 1.59.x hangs during browser-archive extraction — a yauzl stream-destruction regression ([microsoft/playwright#40724](https://github.com/microsoft/playwright/issues/40724)), fixed in 1.60.0. Do not downgrade below 1.60 while on Node 26.
- The lockfile is now `pnpm-lock.yaml`; `package-lock.json` is removed.
- The launchd agents invoke pnpm by **absolute path** (a `__PNPM__` token resolved at install time), with node's directory on the embedded `PATH`. launchd does not search `PATH` for `ProgramArguments[0]`, and Homebrew's pnpm location is machine-specific (`/opt/homebrew/bin` on Apple Silicon, `/usr/local/bin` on Intel), so a bare `pnpm` under `/usr/bin/env` would be fragile across machines. Any already-loaded agents must be reloaded via `scripts/install-launchd.sh` to pick up the change.
