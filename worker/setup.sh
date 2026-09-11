#!/usr/bin/env bash
# One-shot setup for the notes Worker.
#
#   wrangler login      # once, opens a browser
#   ./setup.sh
#
# Creates the KV namespace, writes its id into wrangler.toml, generates and
# stores a moderator key, deploys, and prints the URL the site should use.
set -euo pipefail
cd "$(dirname "$0")"

W="npx --yes wrangler@latest"

echo "==> checking login"
if ! $W whoami >/dev/null 2>&1; then
  echo "Not logged in. Run:  npx wrangler login" >&2
  exit 1
fi
$W whoami 2>/dev/null | grep -i "account" | head -2 || true

if grep -q 'REPLACE_WITH_KV_ID' wrangler.toml; then
  echo "==> creating KV namespace"
  OUT="$($W kv namespace create NOTES 2>&1 || true)"
  echo "$OUT"
  # the id is the first 32-character hex string in the output
  ID="$(printf '%s' "$OUT" | grep -oE '[0-9a-f]{32}' | head -1 || true)"
  if [ -z "$ID" ]; then
    echo "Could not read the namespace id from the output above." >&2
    echo "Paste it into wrangler.toml by hand, replacing REPLACE_WITH_KV_ID." >&2
    exit 1
  fi
  # macOS and GNU sed disagree about -i, so write through a temp file
  sed "s/REPLACE_WITH_KV_ID/$ID/" wrangler.toml > wrangler.toml.tmp
  mv wrangler.toml.tmp wrangler.toml
  echo "==> KV namespace $ID written into wrangler.toml"
else
  echo "==> KV namespace already configured"
fi

echo "==> setting the moderator key"
KEY="$(openssl rand -hex 24)"
# Printed BEFORE it is uploaded. A secret cannot be read back out of
# Cloudflare, so if anything later in this script fails after the upload, an
# unprinted key is simply lost.
echo
echo "  ---------------------------------------------------------------"
echo "  MODERATOR KEY - save this now, it cannot be read back:"
echo
echo "    $KEY"
echo "  ---------------------------------------------------------------"
echo
printf '%s' "$KEY" | $W secret put MODERATOR_KEY

echo "==> deploying"
LOG="$(mktemp)"
# Streamed rather than captured into a variable: capturing hid the reason a
# deploy failed, and `set -e` then aborted before anything useful printed.
set +e
$W deploy 2>&1 | tee "$LOG"
STATUS="${PIPESTATUS[0]}"
set -e
if [ "$STATUS" -ne 0 ]; then
  echo
  if grep -q "workers.dev subdomain" "$LOG"; then
    # The usual first-run failure on a new account: the Worker uploads fine,
    # but there is no workers.dev subdomain yet for it to be published to.
    echo "The Worker uploaded, but this account has no workers.dev subdomain" >&2
    echo "yet, so there is no URL to publish it to. One-time step:" >&2
    echo >&2
    echo "  1. Pick a subdomain (any name):" >&2
    echo "     https://dash.cloudflare.com/$(npx --yes wrangler@latest whoami 2>/dev/null | grep -oE '[0-9a-f]{32}' | head -1)/workers/onboarding" >&2
    echo "  2. Run this script again." >&2
  else
    echo "Deploy failed (exit $STATUS) - see the error above." >&2
    echo "Once it is fixed:  cd worker && npx wrangler deploy" >&2
  fi
  echo >&2
  echo "The moderator key printed above is already set. Keep it." >&2
  exit "$STATUS"
fi
URL="$(grep -oE 'https://[a-z0-9.-]*workers\.dev' "$LOG" | head -1 || true)"
rm -f "$LOG"

echo
echo "-----------------------------------------------------------------------"
echo "Moderator key (save this; it is not shown again):"
echo "  $KEY"
echo
if [ -n "$URL" ]; then
  echo "Worker URL:"
  echo "  $URL"
  echo
  echo "Point the site at it:"
  echo "  gh variable set NOTES_API --body \"$URL\" --repo joeo235/uchicago-oblong-table"
  echo "  git commit --allow-empty -m 'Rebuild against the notes Worker' && git push"
  echo
  echo "Check it:"
  echo "  curl -s $URL/health"
else
  echo "Deployed. Take the workers.dev URL from the output above."
fi
echo
echo "To remove a note:"
echo "  curl -X DELETE -H \"X-Moderator-Key: $KEY\" <worker-url>/notes/<note-id>"
echo "-----------------------------------------------------------------------"
