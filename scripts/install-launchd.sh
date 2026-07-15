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
# Override the auto-detected values if the guesses are wrong for your setup:
#   PNPM_BIN="/opt/homebrew/bin/pnpm" scripts/install-launchd.sh   # absolute pnpm path
#   LAUNCHD_PATH="/opt/homebrew/bin:/usr/bin:/bin" scripts/install-launchd.sh   # agent PATH
#   LOG_DIR="$HOME/some/dir" scripts/install-launchd.sh            # agent log directory
# (LAUNCHD_PATH defaults to the directories holding pnpm + node plus /usr/bin:/bin.
#  LOG_DIR defaults to ~/Library/Logs and must stay outside the TCC-protected
#  folders — ~/Documents, ~/Desktop, ~/Downloads — or launchd cannot open the
#  log file and the agents die with a silent exit 78; see ADR-0009.)
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
    local pnpm_bin node_bin pnpm_dir node_dir result
    pnpm_bin="$(command -v pnpm 2>/dev/null || true)"
    node_bin="$(command -v node 2>/dev/null || true)"
    if [ -z "$pnpm_bin" ] || [ -z "$node_bin" ]; then
        echo "error: cannot find pnpm or node on \$PATH." >&2
        echo "Install pnpm (e.g. brew install pnpm) and Node.js, or set LAUNCHD_PATH explicitly." >&2
        exit 1
    fi
    pnpm_dir="$(dirname "$pnpm_bin")"
    node_dir="$(dirname "$node_bin")"
    result="$pnpm_dir:$node_dir:/usr/bin:/bin"
    printf %s "$result" | awk -v RS=: -v ORS=: '$0 != "" && !seen[$0]++' | sed 's/:$//'
}

render() {
    # Substitute placeholders and strip the leading <!-- ... --> template comment.
    sed -e "s|__REPO_PATH__|$REPO_PATH|g" -e "s|__PNPM__|$PNPM_BIN|g" -e "s|__PATH__|$LAUNCHD_PATH|g" \
        -e "s|__LOG_DIR__|$LOG_DIR|g" "$1" \
        | sed '/^<!--$/,/^-->$/d'
}

LAUNCHD_PATH="${LAUNCHD_PATH:-$(resolve_path)}"

# Logs must live outside ~/Documents (and the other TCC-protected folders):
# launchd opens StandardOutPath before spawning the job, and macOS privacy
# protection denies that open for non-Apple programs, killing the agent with a
# silent exit 78 (EX_CONFIG). See ADR-0009.
LOG_DIR="${LOG_DIR:-$HOME/Library/Logs}"
case "$LOG_DIR" in
    "$HOME/Documents"*|"$HOME/Desktop"*|"$HOME/Downloads"*)
        echo "error: LOG_DIR=$LOG_DIR is inside a TCC-protected folder; launchd" >&2
        echo "cannot open log files there (silent exit 78). Pick a path outside" >&2
        echo "~/Documents, ~/Desktop and ~/Downloads — e.g. ~/Library/Logs." >&2
        exit 1
        ;;
esac

# launchd resolves ProgramArguments[0] without searching PATH, so the plist needs
# pnpm's absolute path — and Homebrew's location is machine-specific (Apple Silicon
# /opt/homebrew/bin vs Intel /usr/local/bin).
PNPM_BIN="${PNPM_BIN:-$(command -v pnpm 2>/dev/null || true)}"
if [ -z "$PNPM_BIN" ]; then
    echo "error: cannot find pnpm on \$PATH." >&2
    echo "Install it (brew install pnpm) or set PNPM_BIN to its absolute path." >&2
    exit 1
fi

echo "Repo path:        $REPO_PATH"
echo "pnpm binary:      $PNPM_BIN"
echo "Embedded PATH:    $LAUNCHD_PATH"
echo "Log directory:    $LOG_DIR"
echo "LaunchAgents dir: $LAUNCH_AGENTS"
echo "Mode:             $([ "$DRY_RUN" = 1 ] && echo dry-run || echo install)"
echo

if [ "$DRY_RUN" = 0 ]; then
    mkdir -p "$LAUNCH_AGENTS" "$LOG_DIR"
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
echo "  tail -f $LOG_DIR/rental-fetch.log $LOG_DIR/rental-notify.log"
