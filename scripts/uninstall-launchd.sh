#!/usr/bin/env bash
#
# Unload both launchd agents and remove their plists from ~/Library/LaunchAgents.
# Logs under local/*.log are left in place; delete them by hand if you want a
# clean slate.
#
# Usage:
#   scripts/uninstall-launchd.sh
#
set -euo pipefail

LAUNCH_AGENTS="$HOME/Library/LaunchAgents"
PLISTS=(com.lyeyixian.rental-fetch.plist com.lyeyixian.rental-notify.plist)

for plist in "${PLISTS[@]}"; do
    dst="$LAUNCH_AGENTS/$plist"
    label="${plist%.plist}"

    echo "=== $plist ==="

    if launchctl list "$label" >/dev/null 2>&1; then
        echo "Unloading $label..."
        launchctl unload "$dst" 2>/dev/null || true
    else
        echo "Not loaded: $label"
    fi

    if [ -f "$dst" ]; then
        rm "$dst"
        echo "Removed $dst"
    else
        echo "Not present: $dst"
    fi
    echo
done

echo "Done."
