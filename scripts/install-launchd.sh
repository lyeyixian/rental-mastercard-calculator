#!/usr/bin/env bash
#
# Render the plist templates under launchd/ with this machine's paths, install
# them into ~/Library/LaunchAgents, and load them via launchctl. Re-running is
# idempotent: any already-loaded agent is unloaded first so the new copy wins.
#
# The installed plist drops the template's "Tokens to replace" header comment —
# that comment only makes sense in the unrendered template.
#
# Usage:
#   scripts/install-launchd.sh           # render, write, and load
#   scripts/install-launchd.sh --dry-run # print the rendered plists; touch nothing
#
# Override the embedded PATH (defaults to the directories holding npm + node
# plus /usr/bin:/bin):
#   LAUNCHD_PATH="/opt/homebrew/bin:/usr/bin:/bin" scripts/install-launchd.sh
#
set -euo pipefail

REPO_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LAUNCH_AGENTS="$HOME/Library/LaunchAgents"
PLISTS=(com.lyeyixian.rental-fetch.plist com.lyeyixian.rental-notify.plist)

DRY_RUN=0
if [ "${1:-}" = "--dry-run" ]; then
    DRY_RUN=1
fi

resolve_path() {
    local npm_bin node_bin npm_dir node_dir result
    npm_bin="$(command -v npm 2>/dev/null || true)"
    node_bin="$(command -v node 2>/dev/null || true)"
    if [ -z "$npm_bin" ] || [ -z "$node_bin" ]; then
        echo "error: cannot find npm or node on \$PATH." >&2
        echo "Install Node.js (e.g. brew install node) or set LAUNCHD_PATH explicitly." >&2
        exit 1
    fi
    npm_dir="$(dirname "$npm_bin")"
    node_dir="$(dirname "$node_bin")"
    result="$npm_dir:$node_dir:/usr/bin:/bin"
    printf %s "$result" | awk -v RS=: -v ORS=: '$0 != "" && !seen[$0]++' | sed 's/:$//'
}

render() {
    # Substitute placeholders and strip the leading <!-- ... --> template comment.
    sed -e "s|__REPO_PATH__|$REPO_PATH|g" -e "s|__PATH__|$LAUNCHD_PATH|g" "$1" \
        | sed '/^<!--$/,/^-->$/d'
}

LAUNCHD_PATH="${LAUNCHD_PATH:-$(resolve_path)}"

echo "Repo path:        $REPO_PATH"
echo "Embedded PATH:    $LAUNCHD_PATH"
echo "LaunchAgents dir: $LAUNCH_AGENTS"
echo "Mode:             $([ "$DRY_RUN" = 1 ] && echo dry-run || echo install)"
echo

if [ "$DRY_RUN" = 0 ]; then
    mkdir -p "$LAUNCH_AGENTS"
fi

for plist in "${PLISTS[@]}"; do
    src="$REPO_PATH/launchd/$plist"
    dst="$LAUNCH_AGENTS/$plist"
    label="${plist%.plist}"

    if [ ! -f "$src" ]; then
        echo "error: template missing: $src" >&2
        exit 1
    fi

    echo "=== $plist ==="

    if [ "$DRY_RUN" = 1 ]; then
        render "$src"
        echo
        continue
    fi

    if launchctl list "$label" >/dev/null 2>&1; then
        echo "Unloading existing $label..."
        launchctl unload "$dst" 2>/dev/null || true
    fi

    render "$src" > "$dst"
    echo "Wrote $dst"

    launchctl load "$dst"
    echo "Loaded $label"
    echo
done

if [ "$DRY_RUN" = 1 ]; then
    echo "(dry-run) nothing was written or loaded."
    exit 0
fi

echo "Done. Verify with:"
echo "  launchctl list | grep lyeyixian"
echo "  tail -f $REPO_PATH/local/fetch.log $REPO_PATH/local/notify.log"
