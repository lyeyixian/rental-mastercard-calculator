#!/usr/bin/env bash
#
# Link the units under systemd/ into the user manager, enable both timers,
# and turn on lingering so the timers keep running after you log out.
#
# The units are symlinked straight out of this checkout, not copied, so a
# `git pull` followed by `systemctl --user daemon-reload` picks up edits.
# They assume the repo lives at ~/repo/rental-mastercard-calculator and that
# node and pnpm come from nvm; see the comments in each unit.
#
# Re-running is safe: link and enable are no-ops for units already in place,
# and the timers are restarted so an edited OnCalendar= takes effect.
#
# Usage:
#   scripts/install-systemd.sh
#
set -euo pipefail

REPO_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXPECTED_PATH="$HOME/repo/rental-mastercard-calculator"
UNIT_DIR="$REPO_PATH/systemd"
SERVICES=(rental-fetch.service rental-notify.service)
TIMERS=(rental-fetch.timer rental-notify.timer)

if ! command -v systemctl >/dev/null 2>&1; then
    echo "error: systemctl not found; this script is for Linux hosts running systemd." >&2
    exit 1
fi

if [ "$REPO_PATH" != "$EXPECTED_PATH" ]; then
    echo "error: this checkout is at $REPO_PATH but the units hardcode" >&2
    echo "WorkingDirectory=$EXPECTED_PATH. Move the checkout or edit the units." >&2
    exit 1
fi

if [ ! -s "$HOME/.nvm/nvm.sh" ]; then
    echo "error: ~/.nvm/nvm.sh not found; the units source it to find node and pnpm." >&2
    exit 1
fi

# rental-fetch.service resolves xvfb-run through the PATH nvm.sh leaves in
# place, which includes /usr/bin.
if [ ! -x /usr/bin/xvfb-run ]; then
    echo "error: /usr/bin/xvfb-run not found; rental-fetch.service needs it (sudo apt install xvfb)." >&2
    exit 1
fi

for unit in "${SERVICES[@]}" "${TIMERS[@]}"; do
    if [ ! -f "$UNIT_DIR/$unit" ]; then
        echo "error: unit missing: $UNIT_DIR/$unit" >&2
        exit 1
    fi
done

# Services have no [Install] section, so they are linked rather than enabled.
# link is a no-op when the symlink already points at this file.
for service in "${SERVICES[@]}"; do
    systemctl --user link "$UNIT_DIR/$service" >/dev/null
    echo "Linked $service"
done

# enable with a path links and enables in one step. enable --now would leave
# an already-running timer on its old schedule, so restart it separately.
for timer in "${TIMERS[@]}"; do
    systemctl --user enable "$UNIT_DIR/$timer" >/dev/null
    systemctl --user restart "$timer"
    echo "Enabled and (re)started $timer"
done

# Without lingering, user timers stop the moment the last login session
# ends. This is a one-time per-user setting that survives reboots.
if [ "$(loginctl show-user "$USER" -p Linger --value)" = "yes" ]; then
    echo "Lingering already on for $USER"
else
    loginctl enable-linger "$USER"
    echo "Enabled lingering for $USER"
fi
echo

echo "Done. Verify with:"
echo "  systemctl --user list-timers 'rental-*'"
echo "  journalctl --user -u rental-fetch.service -u rental-notify.service -f"
echo
echo "To run the fetch right now instead of waiting for 19:00:"
echo "  systemctl --user start rental-fetch.service"
