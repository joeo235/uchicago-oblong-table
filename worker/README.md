# Notes Worker

A small Cloudflare Worker holding the notes people leave at the table, so a
note written at a place can be read by whoever sits there next.

## Deploy

```bash
npx wrangler login     # once; opens a browser
./setup.sh
```

`setup.sh` creates the KV namespace, writes its id into `wrangler.toml`,
generates a moderator key and stores it as a secret, deploys, and prints the
URL plus the one command that points the site at it.

## Endpoints

| | |
|---|---|
| `GET /notes` | every note, oldest first, most recent 400 |
| `POST /notes` | `{ seat, text, visitor }` — creates one |
| `DELETE /notes/:id` | requires `X-Moderator-Key` |
| `GET /health` | liveness |

## A note on timing

KV is eventually consistent, so a note is not necessarily in the very next
read. The client holds notes it has just written and merges them into its own
view, so the person writing never sees their note vanish — but somebody
*else* may not see it for up to about a minute. That is a property of the
storage rather than something the client can hide.

## How notes are stored

One KV key per note, `note:<padded-timestamp>:<id>`, with the note itself in
the key's **metadata**. Two consequences worth knowing:

- A single `list()` returns every note, with no read per note.
- Two people writing at the same instant cannot lose each other's note. A
  single JSON blob under one key is a read-modify-write, and under concurrency
  one of the two writes disappears — a bad failure for a piece about shared
  conversation.

Metadata is capped at 1024 bytes by KV, so the text is trimmed until the
record fits. 280 characters of ordinary prose is far inside that; 280
characters of emoji is not, which is why the check is on bytes.

## What stops abuse

Anyone who opens the site can write, so this is a public text box:

- 280 character cap, enforced again here because clients lie
- per-IP rate limit, 5 notes per 10 minutes, configurable in `wrangler.toml`
- an origin check, which turns away drive-by bots but not anyone determined
- a moderator key that can delete any note
- the store is pruned when it passes 1500 notes

The rate limit rides on KV, which is eventually consistent, so treat it as a
speed bump rather than a guarantee. **Somebody should watch what accumulates.**
This is the part of the feature that needs a person, not code.

## Looking at, and removing, notes

```bash
export MODERATOR_KEY=...        # the key setup.sh printed
./notes.sh list                 # every note with its id; needs no key
./notes.sh delete <id>          # remove one
./notes.sh clear                # remove all of them (asks first)
```

Reading needs no key. Removing does.

## Local development

```bash
npx wrangler dev      # simulates KV locally, no account needed
```
