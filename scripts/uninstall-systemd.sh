#!/usr/bin/env bash
#
# Stop and disable both timers and unlink all four units from the user
# manager. Journal entries are left in place, and so is lingering, since
# other user services on the machine may rely on it:
#   loginctl disable-linger "$USER"   # if you want it off too
#
# Usage:
#   scripts/uninstall-systemd.sh
#
set -euo pipefail

SERVICES=(rental-fetch.service rental-notify.service)
TIMERS=(rental-fetch.timer rental-notify.timer)

if ! command -v systemctl >/dev/null 2>&1; then
    echo "error: systemctl not found; this script is for Linux hosts running systemd." >&2
    exit 1
fi

# disable removes the timers.target symlink and the link into the unit
# directory in one go; --now stops the timer first.
for timer in "${TIMERS[@]}"; do
    if systemctl --user cat "$timer" >/dev/null 2>&1; then
        systemctl --user disable --now "$timer"
        echo "Disabled and unlinked $timer"
    else
        echo "Not installed: $timer"
    fi
done

# Linked services have no [Install] section, so disable only removes the link.
for service in "${SERVICES[@]}"; do
    if systemctl --user cat "$service" >/dev/null 2>&1; then
        systemctl --user disable "$service"
        echo "Unlinked $service"
    else
        echo "Not installed: $service"
    fi
done

systemctl --user daemon-reload
echo "Done."
