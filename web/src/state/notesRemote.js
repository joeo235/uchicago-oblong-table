/**
 * The shared note store: the same `list` and `add` as LocalNotes, but against
 * the Cloudflare Worker in ../../worker, so a note left at a place can be read
 * by whoever sits there next.
 *
 * Every failure is soft. If the Worker is unreachable the table still works —
 * you simply cannot read or leave notes, and the panel says so. Nothing here
 * is allowed to stop the scene running.
 *
 * KV is eventually consistent, so a note that has just been written is not
 * necessarily in the next read: the write succeeds and the list comes back
 * without it, which looks to the writer like the note vanished. Notes this
 * client created are therefore held briefly and merged into `list()` until the
 * server starts reporting them. Other people's notes can still take up to
 * about a minute to appear, which is a property of the storage and not
 * something the client can paper over.
 */
import { cleanNote } from './notes.js'

const TIMEOUT_MS = 8000

function valid(n) {
  return n && Number.isInteger(n.seat) && typeof n.text === 'string'
    && n.text.length > 0 && Number.isFinite(n.at)
}

async function withTimeout(url, options = {}) {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, { ...options, signal: ctl.signal })
  } finally {
    clearTimeout(timer)
  }
}

export class RemoteNotes {
  constructor(base) {
    this.base = String(base).replace(/\/+$/, '')
    this.shared = true
    this.lastError = null
    /** Notes written here that the server has not caught up with yet. */
    this.pending = new Map()
    this.pendingTtlMs = 120000
  }

  /** Merge freshly written notes in, and forget ones the server now has. */
  _reconcile(fromServer) {
    const known = new Set(fromServer.map((n) => n.id))
    const now = Date.now()
    for (const [id, note] of this.pending) {
      if (known.has(id) || now - note.at > this.pendingTtlMs) this.pending.delete(id)
    }
    if (!this.pending.size) return fromServer
    return [...fromServer, ...this.pending.values()].sort((a, b) => a.at - b.at)
  }

  async list() {
    try {
      const res = await withTimeout(`${this.base}/notes`, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(`server said ${res.status}`)
      const data = await res.json()
      this.lastError = null
      const server = Array.isArray(data?.notes)
        ? data.notes.filter(valid).sort((a, b) => a.at - b.at)
        : []
      return this._reconcile(server)
    } catch (err) {
      this.lastError = err.name === 'AbortError'
        ? 'The table’s notes are taking too long to load.'
        : 'Could not reach the table’s notes just now.'
      // Still show what this visitor wrote, rather than appearing to lose it.
      return this._reconcile([])
    }
  }

  async add({ seat, text, visitor }) {
    const clean = cleanNote(text)
    if (clean === null) {
      this.lastError = 'That note is too short to leave.'
      return null
    }
    try {
      const res = await withTimeout(`${this.base}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seat, text: clean, visitor }),
      })
      if (res.status === 429) {
        this.lastError = 'A few notes have gone down from here already — try again shortly.'
        return null
      }
      if (!res.ok) {
        let detail = ''
        try { detail = (await res.json())?.error ?? '' } catch { /* ignore */ }
        this.lastError = detail
          ? `The note was not accepted: ${detail}.`
          : `The note was not accepted (${res.status}).`
        return null
      }
      const data = await res.json()
      this.lastError = null
      if (!valid(data?.note)) return null
      this.pending.set(data.note.id, data.note)
      return data.note
    } catch (err) {
      this.lastError = err.name === 'AbortError'
        ? 'That took too long. The note was not saved.'
        : 'Could not reach the table just now. The note was not saved.'
      return null
    }
  }
}

/**
 * Pick a store. A configured Worker URL means notes are shared; without one
 * they stay in this browser, which the panel states plainly either way.
 */
export function createNoteStore(apiUrl, LocalNotes) {
  return apiUrl ? new RemoteNotes(apiUrl) : new LocalNotes()
}
