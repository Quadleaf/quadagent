#!/usr/bin/env bash
#
# install.sh - make this repo canonical for the machine's global Claude Code config.
#
# For each file listed in MIRRORS, this replaces the live copy under the Claude
# config dir (default ~/.claude) with a symlink pointing into this repo. Anything
# already present at the target that is NOT already the correct symlink is backed
# up first, so nothing is lost.
#
# The script is idempotent: re-running it is a no-op for links that are already
# correct.
#
# Usage:
#   ./install.sh [--dry-run]
#
# Env:
#   CLAUDE_CONFIG_DIR   Target config dir (default: $HOME/.claude)

set -euo pipefail

# --- resolve repo dir (this script's location), following symlinks ------------
SOURCE="${BASH_SOURCE[0]}"
while [ -L "$SOURCE" ]; do
  DIR="$(cd -P "$(dirname "$SOURCE")" >/dev/null 2>&1 && pwd)"
  SOURCE="$(readlink "$SOURCE")"
  [[ "$SOURCE" != /* ]] && SOURCE="$DIR/$SOURCE"
done
REPO_DIR="$(cd -P "$(dirname "$SOURCE")" >/dev/null 2>&1 && pwd)"

CONFIG_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"

DRY_RUN=0
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1

# --- manifest: repo-relative paths that mirror into $CONFIG_DIR at the same ----
# --- relative path. Add skills/hooks/settings here as they get committed.  -----
MIRRORS=(
  "CLAUDE.md"
)

# --- helpers ------------------------------------------------------------------
run() {
  if [[ $DRY_RUN -eq 1 ]]; then
    echo "  [dry-run] $*"
  else
    "$@"
  fi
}

TS="$(date +%Y%m%d-%H%M%S)"
BACKUP_ROOT="$CONFIG_DIR/.quad-agent-backups/$TS"
made_backup_dir=0

ensure_backup_dir() {
  if [[ $made_backup_dir -eq 0 ]]; then
    run mkdir -p "$BACKUP_ROOT"
    made_backup_dir=1
  fi
}

echo "Repo (canonical): $REPO_DIR"
echo "Config dir:       $CONFIG_DIR"
[[ $DRY_RUN -eq 1 ]] && echo "Mode:             DRY RUN (no changes will be made)"
echo

for rel in "${MIRRORS[@]}"; do
  src="$REPO_DIR/$rel"
  dst="$CONFIG_DIR/$rel"

  if [[ ! -e "$src" ]]; then
    echo "SKIP  $rel - missing in repo ($src)"
    continue
  fi

  # Already the correct symlink?
  if [[ -L "$dst" && "$(readlink "$dst")" == "$src" ]]; then
    echo "OK    $rel - already linked"
    continue
  fi

  # Ensure parent dir of target exists.
  run mkdir -p "$(dirname "$dst")"

  # Back up whatever is there (real file, dir, or a symlink pointing elsewhere).
  if [[ -e "$dst" || -L "$dst" ]]; then
    ensure_backup_dir
    backup_path="$BACKUP_ROOT/$rel"
    run mkdir -p "$(dirname "$backup_path")"
    echo "BACK  $rel - moving existing copy to ${backup_path#$HOME/~}"
    run mv "$dst" "$backup_path"
  fi

  echo "LINK  $rel -> $src"
  run ln -s "$src" "$dst"
done

echo
if [[ $made_backup_dir -eq 1 ]]; then
  echo "Backups saved under: $BACKUP_ROOT"
fi
echo "Done."
