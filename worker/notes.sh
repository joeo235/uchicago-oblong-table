#!/usr/bin/env bash
# Look at, and remove, the notes people have left on the table.
#
#   export MODERATOR_KEY=...            # the key setup.sh printed
#   ./notes.sh list                     # every note, with its id
#   ./notes.sh delete <id>              # remove one
#   ./notes.sh clear                    # remove all of them (asks first)
#
# Reading needs no key. Removing does.
set -euo pipefail
cd "$(dirname "$0")"

API="${NOTES_API:-https://oblong-table-notes.uchicago.workers.dev}"
CMD="${1:-list}"

need_key() {
  if [ -z "${MODERATOR_KEY:-}" ]; then
    echo "Set MODERATOR_KEY first (the key setup.sh printed):" >&2
    echo "  export MODERATOR_KEY=..." >&2
    exit 1
  fi
}

case "$CMD" in
  list)
    curl -s --max-time 20 "$API/notes" | python3 -c '
import sys, json, datetime
d = json.load(sys.stdin)
notes = d.get("notes", [])
if not notes:
    print("No notes on the table.")
else:
    for n in notes:
        when = datetime.datetime.fromtimestamp(n["at"] / 1000).strftime("%Y-%m-%d %H:%M")
        print(f'"'"'{n["id"]}  seat {n["seat"]:>2}  {when}  {n["text"][:72]}'"'"')
    print(f"\n{len(notes)} note(s).")
'
    ;;
  delete)
    need_key
    ID="${2:?usage: ./notes.sh delete <id>}"
    curl -s --max-time 20 -X DELETE "$API/notes/$ID" \
      -H "X-Moderator-Key: $MODERATOR_KEY"
    echo
    ;;
  clear)
    need_key
    IDS="$(curl -s --max-time 20 "$API/notes" \
      | python3 -c 'import sys,json;[print(n["id"]) for n in json.load(sys.stdin).get("notes",[])]')"
    if [ -z "$IDS" ]; then echo "Nothing to clear."; exit 0; fi
    COUNT="$(printf '%s\n' "$IDS" | wc -l | tr -d ' ')"
    printf 'Remove all %s note(s)? [y/N] ' "$COUNT"
    read -r ANSWER
    case "$ANSWER" in
      y|Y) ;;
      *) echo "Left alone."; exit 0 ;;
    esac
    for id in $IDS; do
      printf '  %s -> ' "$id"
      curl -s --max-time 20 -X DELETE "$API/notes/$id" \
        -H "X-Moderator-Key: $MODERATOR_KEY"
      echo
    done
    ;;
  *)
    echo "usage: ./notes.sh [list|delete <id>|clear]" >&2
    exit 2
    ;;
esac
