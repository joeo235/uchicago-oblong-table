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
printf '%s' "$KEY" | $W secret put MODERATOR_KEY

echo "==> deploying"
DEPLOY="$($W deploy 2>&1)"
echo "$DEPLOY"
URL="$(printf '%s' "$DEPLOY" | grep -oE 'https://[a-z0-9.-]*workers\.dev' | head -1 || true)"

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
