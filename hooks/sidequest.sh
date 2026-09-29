#!/usr/bin/env bash
# Sidequest Cursor hook: forwards agent lifecycle events to the relay server.
#
# Usage (from hooks.json): sidequest.sh <eventName>
# Reads the Cursor hook JSON on stdin, wraps it and POSTs it to $SIDEQUEST_URL.
# The POST is fired in the background with a 1s cap so the agent is never slowed
# down, and the script always exits 0 (fail open): a missing relay must never
# break the editor.

set -u

EVENT="${1:-unknown}"
INPUT="$(cat)"

# Relay location: env var, then ~/.cursor/sidequest.env, then localhost default.
if [[ -z "${SIDEQUEST_URL:-}" && -f "$HOME/.cursor/sidequest.env" ]]; then
  # shellcheck disable=SC1091
  source "$HOME/.cursor/sidequest.env"
fi
SIDEQUEST_URL="${SIDEQUEST_URL:-http://127.0.0.1:80}"

if command -v jq >/dev/null 2>&1; then
  PROJECT="$(printf '%s' "$INPUT" | jq -r '(.workspace_roots[0] // .cwd // "") | split("/") | last // ""' 2>/dev/null)"
  BODY="$(printf '%s' "$INPUT" | jq -c \
    --arg event "$EVENT" \
    --arg project "${PROJECT:-unknown}" \
    --argjson ts "$(date +%s%3N 2>/dev/null || echo $(( $(date +%s) * 1000 )))" \
    '{event: $event, project: $project, timestamp: $ts, conversationId: (.conversation_id // null), payload: .}' 2>/dev/null)"
else
  # Without jq we cannot safely embed the raw payload; send the envelope only.
  BODY="{\"event\":\"$EVENT\",\"project\":\"unknown\",\"timestamp\":$(( $(date +%s) * 1000 )),\"payload\":{}}"
fi

if [[ -n "${BODY:-}" ]]; then
  (
    curl --silent --output /dev/null --max-time 1 \
      -H 'Content-Type: application/json' \
      -X POST "$SIDEQUEST_URL/events" \
      --data-binary "$BODY" >/dev/null 2>&1 &
  )
fi

# beforeSubmitPrompt expects a decision; every other event ignores stdout.
if [[ "$EVENT" == "beforeSubmitPrompt" ]]; then
  echo '{"continue": true}'
fi
exit 0
