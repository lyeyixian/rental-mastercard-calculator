#!/usr/bin/env bash
#
# Stop and disable both timers, remove the four units from
# ~/.config/systemd/user, and reload the user manager. Journal entries are
# left in place.
#
# Usage:
#   scripts/uninstall-systemd.sh
#
set -euo pipefail

UNIT_DIR="$HOME/.config/systemd/user"
UNITS=(rental-fetch.service rental-fetch.timer rental-notify.service rental-notify.timer)
TIMERS=(rental-fetch.timer rental-notify.timer)

if ! command -v systemctl >/dev/null 2>&1; then
    echo "error: systemctl not found; this script is for Linux hosts running systemd." >&2
    exit 1
fi

for timer in "${TIMERS[@]}"; do
    echo "=== $timer ==="
    if systemctl --user is-enabled "$timer" >/dev/null 2>&1 \
        || systemctl --user is-active "$timer" >/dev/null 2>&1; then
        systemctl --user disable --now "$timer"
        echo "Disabled $timer"
    else
        echo "Not enabled: $timer"
    fi
    echo
done

for unit in "${UNITS[@]}"; do
    dst="$UNIT_DIR/$unit"
    if [ -f "$dst" ]; then
        rm "$dst"
        echo "Removed $dst"
    else
        echo "Not present: $dst"
    fi
done
echo

systemctl --user daemon-reload
echo "Reloaded the user manager"
echo "Done."
