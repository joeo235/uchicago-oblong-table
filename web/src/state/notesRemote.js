/**
 * The shared note store: the same `list` and `add` as LocalNotes, but against
 * the Cloudflare Worker in ../../worker, so a note left at a place can be read
 * by whoever sits there next.
 *
 * Every failure is soft. If the Worker is unreachable the table still works —
 * you simply cannot read or leave notes, and the panel says so. Nothing here
 * is allowed to stop the scene running.
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
      return Array.isArray(data?.notes)
        ? data.notes.filter(valid).sort((a, b) => a.at - b.at)
        : []
    } catch (err) {
      this.lastError = err.name === 'AbortError'
        ? 'The table’s notes are taking too long to load.'
        : 'Could not reach the table’s notes just now.'
      return []
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
      return valid(data?.note) ? data.note : null
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
