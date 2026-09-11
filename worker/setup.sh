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
echo
# Run un-piped. Wrangler asks questions here on a first deploy — notably which
# workers.dev subdomain to use — and it only asks when it can see a terminal.
# Piping this through tee to capture the URL hid the question entirely.
set +e
$W deploy
STATUS=$?
set -e
if [ "$STATUS" -ne 0 ]; then
  echo
  echo "Deploy did not finish (exit $STATUS) - see the error above." >&2
  echo "If it mentioned a workers.dev subdomain: run this script again and" >&2
  echo "answer yes, then type any name you like." >&2
  echo >&2
  echo "The moderator key printed above is already set. Keep it." >&2
  exit "$STATUS"
fi

echo
echo "-----------------------------------------------------------------------"
echo "Moderator key (save this; it is not shown again):"
echo "  $KEY"
echo
echo "Deployed. Copy the https://....workers.dev address from the output above,"
echo "then point the site at it:"
echo
echo "  gh variable set NOTES_API --body <that-url> --repo joeo235/uchicago-oblong-table"
echo "  git commit --allow-empty -m 'Rebuild against the notes Worker' && git push"
echo
echo "Check the Worker is answering:"
echo "  curl -s <that-url>/health"
echo
echo "To remove a note:"
echo "  curl -X DELETE -H \"X-Moderator-Key: $KEY\" <worker-url>/notes/<note-id>"
echo "-----------------------------------------------------------------------"
