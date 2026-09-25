#!/usr/bin/env bash
# Installs the Sidequest hook as a Cursor *user* hook (~/.cursor/hooks.json).
#
#   ./hooks/install.sh [relay-url]
#
# If ~/.cursor/hooks.json already exists its other hooks are preserved and the
# Sidequest entries are merged in (requires jq). Re-running is idempotent.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CURSOR_DIR="${CURSOR_DIR:-$HOME/.cursor}"
RELAY_URL="${1:-${SIDEQUEST_URL:-http://127.0.0.1:4747}}"

for bin in curl jq; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "error: '$bin' is required by the hook but is not on PATH" >&2
    exit 1
  fi
done

mkdir -p "$CURSOR_DIR/hooks"
cp "$HERE/sidequest.sh" "$CURSOR_DIR/hooks/sidequest.sh"
chmod +x "$CURSOR_DIR/hooks/sidequest.sh"
printf 'SIDEQUEST_URL=%s\n' "$RELAY_URL" > "$CURSOR_DIR/sidequest.env"

TARGET="$CURSOR_DIR/hooks.json"
if [[ -f "$TARGET" ]]; then
  # Drop any previous sidequest entries, then append ours per event.
  TMP="$(mktemp)"
  jq -s '
    .[0] as $existing | .[1] as $ours |
    ($existing.hooks // {}) as $eh |
    {
      version: 1,
      hooks: (
        ($eh | with_entries(.value |= map(select((.command // "") | test("sidequest") | not)))) as $cleaned |
        reduce ($ours.hooks | to_entries[]) as $e ($cleaned;
          .[$e.key] = ((.[$e.key] // []) + $e.value))
      )
    }' "$TARGET" "$HERE/hooks.json" > "$TMP"
  mv "$TMP" "$TARGET"
else
  cp "$HERE/hooks.json" "$TARGET"
fi

echo "Installed Sidequest hook -> $TARGET"
echo "Relay URL: $RELAY_URL (edit $CURSOR_DIR/sidequest.env to change)"
echo "Cursor reloads hooks.json automatically; restart Cursor if events do not show up in the Hooks output channel."
