/**
 * Notes left on the table.
 *
 * "Importantly, this process does not take place in silence, but in candid
 * conversation. We ask questions of our neighbors and seatmates, and we share
 * ideas, insights, and concerns."
 *
 * A note belongs to a place at the table rather than to a person, so what
 * accumulates is a table with writing at some of its settings — which is the
 * thing the passage describes, and the reason the notebooks are there.
 *
 * `Notes` is an interface with two implementations in mind. `LocalNotes` keeps
 * everything in this browser: your own notes, across your own visits, visible
 * to nobody else. A shared implementation needs somewhere hosted to put them,
 * and only has to provide the same `list` and `add`.
 */
export const MAX_NOTE = 280
export const MIN_NOTE = 2

/** Normalise and check a note before it is stored. Returns null if unusable. */
export function cleanNote(text) {
  if (typeof text !== 'string') return null
  // collapse runs of whitespace, keep single newlines, trim
  const t = text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
  if (t.length < MIN_NOTE) return null
  return t.slice(0, MAX_NOTE)
}

function valid(n) {
  return n && Number.isInteger(n.seat) && typeof n.text === 'string'
    && n.text.length > 0 && Number.isFinite(n.at)
}

export class LocalNotes {
  constructor(key = 'oblong-table/notes/v1') {
    this.key = key
    this.shared = false
  }

  async list() {
    try {
      const raw = localStorage.getItem(this.key)
      if (!raw) return []
      const d = JSON.parse(raw)
      if (!Array.isArray(d?.notes)) return []
      return d.notes.filter(valid).sort((a, b) => a.at - b.at)
    } catch {
      return []
    }
  }

  async add({ seat, text, visitor }) {
    const clean = cleanNote(text)
    if (clean === null) return null
    const note = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      seat, text: clean, at: Date.now(), visitor: visitor ?? null,
    }
    const all = await this.list()
    all.push(note)
    try {
      localStorage.setItem(this.key,
        JSON.stringify({ version: 1, notes: all.slice(-500) }))
    } catch {
      return null                      // quota or private browsing
    }
    return note
  }

  async remove(id) {
    const all = (await this.list()).filter((n) => n.id !== id)
    try {
      localStorage.setItem(this.key, JSON.stringify({ version: 1, notes: all }))
      return true
    } catch {
      return false
    }
  }
}

/** Group notes by the place they were left at. */
export function bySeat(notes) {
  const map = new Map()
  for (const n of notes) {
    if (!map.has(n.seat)) map.set(n.seat, [])
    map.get(n.seat).push(n)
  }
  return map
}

/** "just now", "3 hours ago", "last March" — enough to place it in time. */
export function whenText(at) {
  const s = Math.max(0, (Date.now() - at) / 1000)
  if (s < 90) return 'just now'
  const m = s / 60
  if (m < 60) return `${Math.round(m)} minutes ago`
  const h = m / 60
  if (h < 24) return `${Math.round(h)} hour${Math.round(h) === 1 ? '' : 's'} ago`
  const d = h / 24
  if (d < 30) return `${Math.round(d)} day${Math.round(d) === 1 ? '' : 's'} ago`
  return new Date(at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}
