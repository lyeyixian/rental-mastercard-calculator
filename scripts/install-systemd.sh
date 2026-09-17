#!/usr/bin/env bash
#
# Render the unit templates under systemd/ with this machine's paths, install
# them into ~/.config/systemd/user, reload the user manager, and enable both
# timers. Re-running is idempotent: the units are overwritten and the timers
# restarted, so an edited schedule takes effect immediately.
#
# Linux counterpart of scripts/install-launchd.sh. Output goes to journald, so
# there is no log directory to configure (ADR-0009 does not apply here).
#
# Usage:
#   scripts/install-systemd.sh           # render, write, reload, enable --now
#   scripts/install-systemd.sh --dry-run # print the rendered units; touch nothing
#
# Override the auto-detected values if the guesses are wrong for your setup:
#   PNPM_BIN="/usr/local/bin/pnpm" scripts/install-systemd.sh      # absolute pnpm path
#   SERVICE_PATH="/usr/local/bin:/usr/bin:/bin" scripts/install-systemd.sh   # service PATH
# (SERVICE_PATH defaults to the directories holding pnpm + node plus
#  /usr/local/bin:/usr/bin:/bin.)
#
# Remember `loginctl enable-linger $USER`, or the user timers stop when your
# login session ends.
#
set -euo pipefail

REPO_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UNIT_DIR="$HOME/.config/systemd/user"
UNITS=(rental-fetch.service rental-fetch.timer rental-notify.service rental-notify.timer)
TIMERS=(rental-fetch.timer rental-notify.timer)

DRY_RUN=0
if [ "${1:-}" = "--dry-run" ]; then
    DRY_RUN=1
fi

resolve_path() {
    local pnpm_bin node_bin pnpm_dir node_dir result
    pnpm_bin="$(command -v pnpm 2>/dev/null || true)"
    node_bin="$(command -v node 2>/dev/null || true)"
    if [ -z "$pnpm_bin" ] || [ -z "$node_bin" ]; then
        echo "error: cannot find pnpm or node on \$PATH." >&2
        echo "Install Node.js and pnpm (e.g. corepack enable), or set SERVICE_PATH explicitly." >&2
        exit 1
    fi
    pnpm_dir="$(dirname "$pnpm_bin")"
    node_dir="$(dirname "$node_bin")"
    result="$pnpm_dir:$node_dir:/usr/local/bin:/usr/bin:/bin"
    printf %s "$result" | awk -v RS=: -v ORS=: '$0 != "" && !seen[$0]++' | sed 's/:$//'
}

render() {
    # Drop the "Tokens to replace" paragraph (it only makes sense in the
    # unrendered template), then substitute the placeholders.
    sed '/^# Tokens to replace/,/^$/d' "$1" \
        | sed -e "s|__REPO_PATH__|$REPO_PATH|g" -e "s|__PNPM__|$PNPM_BIN|g" -e "s|__PATH__|$SERVICE_PATH|g"
}

SERVICE_PATH="${SERVICE_PATH:-$(resolve_path)}"

# ExecStart= resolves a bare command name against a fixed search path, not the
# unit's Environment=PATH, so the unit needs pnpm's absolute path (corepack
# shims and fnm installs land in per-user directories).
PNPM_BIN="${PNPM_BIN:-$(command -v pnpm 2>/dev/null || true)}"
if [ -z "$PNPM_BIN" ]; then
    echo "error: cannot find pnpm on \$PATH." >&2
    echo "Install it (corepack enable) or set PNPM_BIN to its absolute path." >&2
    exit 1
fi

if [ "$DRY_RUN" = 0 ]; then
    if ! command -v systemctl >/dev/null 2>&1; then
        echo "error: systemctl not found; this script is for Linux hosts running systemd." >&2
        echo "On macOS use scripts/install-launchd.sh instead." >&2
        exit 1
    fi
    # rental-fetch.service hardcodes /usr/bin/xvfb-run, so check that path
    # rather than $PATH.
    if [ ! -x /usr/bin/xvfb-run ]; then
        echo "error: /usr/bin/xvfb-run not found; rental-fetch.service needs it (sudo apt install xvfb)." >&2
        exit 1
    fi
fi

echo "Repo path:     $REPO_PATH"
echo "pnpm binary:   $PNPM_BIN"
echo "Embedded PATH: $SERVICE_PATH"
echo "Unit dir:      $UNIT_DIR"
echo "Mode:          $([ "$DRY_RUN" = 1 ] && echo dry-run || echo install)"
echo

if [ "$DRY_RUN" = 0 ]; then
    mkdir -p "$UNIT_DIR"
fi

for unit in "${UNITS[@]}"; do
    src="$REPO_PATH/systemd/$unit"
    dst="$UNIT_DIR/$unit"

    if [ ! -f "$src" ]; then
        echo "error: template missing: $src" >&2
        exit 1
    fi

    echo "=== $unit ==="

    if [ "$DRY_RUN" = 1 ]; then
        render "$src"
        echo
        continue
    fi

    render "$src" > "$dst"
    echo "Wrote $dst"
    echo
done

if [ "$DRY_RUN" = 1 ]; then
    echo "(dry-run) nothing was written or enabled."
    exit 0
fi

systemctl --user daemon-reload
echo "Reloaded the user manager"

# enable --now leaves an already-running timer on its old schedule, so restart
# it as well to pick up any edits to OnCalendar=.
for timer in "${TIMERS[@]}"; do
    systemctl --user enable "$timer"
    systemctl --user restart "$timer"
    echo "Enabled and (re)started $timer"
done
echo

echo "Done. Verify with:"
echo "  systemctl --user list-timers 'rental-*'"
echo "  journalctl --user -u rental-fetch.service -u rental-notify.service -f"
echo
echo "To run the fetch right now instead of waiting for 19:00:"
echo "  systemctl --user start rental-fetch.service"
echo
echo "If the timers should survive logout, enable lingering once:"
echo "  loginctl enable-linger $USER"
