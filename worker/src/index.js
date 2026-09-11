/**
 * Notes for The Oblong Table.
 *
 * A small shared store, so that a note left at a place on the table can be
 * read by whoever sits there next. That is the part of the passage the
 * local-only version could not reach: "we ask questions of our neighbors and
 * seatmates, and we share ideas, insights, and concerns."
 *
 * Storage is one KV key per note, with the note itself in the key's metadata.
 * A single `list()` then returns every note without a read per note, and two
 * people writing at the same moment cannot clobber each other — which a
 * single JSON blob under one key would, being a read-modify-write.
 *
 * Anyone who opens the site can write, so this is a public text box. It has a
 * length cap, a per-IP rate limit, an origin check, and a moderator key that
 * can delete. The rate limit rides on KV, which is eventually consistent, so
 * treat it as a speed bump and not a guarantee.
 */

const MAX_CHARS = 280
const MIN_CHARS = 2
const MAX_METADATA_BYTES = 1000     // KV allows 1024; leave headroom
const PAGE_LIMIT = 1000
const MAX_PAGES = 3
const RETURN_LIMIT = 400
const PRUNE_ABOVE = 1500
const PRUNE_BATCH = 300

// Control characters, keeping newline and tab.
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g

const enc = new TextEncoder()

function allowList(env) {
  return String(env.ALLOWED_ORIGINS || '')
    .split(',').map((s) => s.trim()).filter(Boolean)
}

function corsHeaders(request, env) {
  const allowed = allowList(env)
  const origin = request.headers.get('Origin') || ''
  const ok = allowed.includes(origin)
  return {
    'Access-Control-Allow-Origin': ok ? origin : (allowed[0] || '*'),
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Moderator-Key',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...headers,
    },
  })
}

/** The same normalisation the client does, applied again because clients lie. */
function cleanText(raw) {
  if (typeof raw !== 'string') return null
  const t = raw
    .replace(CONTROL, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  if (t.length < MIN_CHARS) return null
  return t.slice(0, MAX_CHARS)
}

/** Trim the text until the metadata will actually fit in KV. */
function fitMetadata(meta) {
  let m = { ...meta }
  while (enc.encode(JSON.stringify(m)).length > MAX_METADATA_BYTES) {
    if (m.text.length <= MIN_CHARS) return null
    m = { ...m, text: m.text.slice(0, Math.floor(m.text.length * 0.9)).trim() }
  }
  return m
}

function keyFor(note) {
  return `note:${String(note.at).padStart(13, '0')}:${note.id}`
}

async function allNotes(env) {
  const out = []
  let cursor
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await env.NOTES.list({ prefix: 'note:', limit: PAGE_LIMIT, cursor })
    for (const k of res.keys) {
      const m = k.metadata
      if (!m || typeof m.text !== 'string' || !Number.isInteger(m.seat)) continue
      out.push({ id: k.name.slice(k.name.lastIndexOf(':') + 1), ...m })
    }
    if (res.list_complete) return { notes: out, complete: true }
    cursor = res.cursor
  }
  return { notes: out, complete: false }
}

async function rateLimited(request, env) {
  const limit = Number(env.RATE_LIMIT || 5)
  const window = Number(env.RATE_WINDOW_SECONDS || 600)
  if (!limit) return false
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown'
  const key = `rl:${ip}`
  const current = Number((await env.NOTES.get(key)) || 0)
  if (current >= limit) return true
  await env.NOTES.put(key, String(current + 1), {
    expirationTtl: Math.max(60, window),
  })
  return false
}

/** Keep the store bounded, but only when the true count is known. */
async function maybePrune(env, listing) {
  if (!listing.complete || listing.notes.length <= PRUNE_ABOVE) return 0
  const oldest = [...listing.notes]
    .sort((a, b) => a.at - b.at)
    .slice(0, PRUNE_BATCH)
  await Promise.all(oldest.map((n) => env.NOTES.delete(keyFor(n))))
  return oldest.length
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env)
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors })
    }
    if (url.pathname === '/health') {
      return json({ ok: true, shared: true }, 200, cors)
    }
    if (url.pathname !== '/notes' && !url.pathname.startsWith('/notes/')) {
      return json({ error: 'not found' }, 404, cors)
    }

    const allowed = allowList(env)
    const origin = request.headers.get('Origin') || ''
    const originOk = allowed.length === 0 || allowed.includes(origin)

    // ---------------------------------------------------------------- read
    if (request.method === 'GET') {
      const listing = await allNotes(env)
      const notes = listing.notes.sort((a, b) => a.at - b.at).slice(-RETURN_LIMIT)
      return json({ notes, truncated: !listing.complete }, 200, cors)
    }

    // --------------------------------------------------------------- write
    if (request.method === 'POST') {
      if (!originOk) return json({ error: 'origin not allowed' }, 403, cors)
      if (await rateLimited(request, env)) {
        return json({ error: 'too many notes from here just now' }, 429, cors)
      }

      let body
      try {
        body = await request.json()
      } catch {
        return json({ error: 'expected json' }, 400, cors)
      }

      const text = cleanText(body?.text)
      const seat = body?.seat
      if (text === null) return json({ error: 'empty note' }, 400, cors)
      if (!Number.isInteger(seat) || seat < 0 || seat > 200) {
        return json({ error: 'bad seat' }, 400, cors)
      }

      const at = Date.now()
      const id = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      const visitor = typeof body?.visitor === 'string'
        ? body.visitor.replace(CONTROL, '').slice(0, 32)
        : null

      const meta = fitMetadata({ seat, text, at, visitor })
      if (!meta) return json({ error: 'note too large' }, 400, cors)

      await env.NOTES.put(keyFor({ at, id }), '', { metadata: meta })
      await maybePrune(env, await allNotes(env))
      return json({ note: { id, ...meta } }, 201, cors)
    }

    // ---------------------------------------------------------- moderation
    if (request.method === 'DELETE') {
      const key = request.headers.get('X-Moderator-Key') || ''
      if (!env.MODERATOR_KEY || key !== env.MODERATOR_KEY) {
        return json({ error: 'not authorised' }, 401, cors)
      }
      const id = url.pathname.split('/').pop()
      const listing = await allNotes(env)
      const found = listing.notes.find((n) => n.id === id)
      if (!found) return json({ error: 'no such note' }, 404, cors)
      await env.NOTES.delete(keyFor(found))
      return json({ deleted: id }, 200, cors)
    }

    return json({ error: 'method not allowed' }, 405, cors)
  },
}
