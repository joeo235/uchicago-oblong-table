/**
 * The DOM layer: gesture panel, legend, reader, and the view toggle.
 *
 * The three gesture buttons are laid out identically on purpose. Nothing in
 * this file should give one of them more prominence than the others.
 */
import { GESTURE_COLOR } from '../config.js'
import { MAX_NOTE, whenText } from '../state/notes.js'
import { CITATION, FULL_TEXT } from './passage.js'

export class Overlay {
  constructor(handlers) {
    this.h = handlers
    this.root = document.getElementById('ui')
    this.gestures = document.getElementById('gestures')
    this.heldName = document.getElementById('held-name')
    this.legend = document.getElementById('legend')
    this.reader = document.getElementById('reader')
    this.notes = document.getElementById('notes')
    this.viewBtn = document.getElementById('view')
    this.noteForm = document.getElementById('note-form')
    this.noteText = document.getElementById('note-text')
    this.noteCount = document.getElementById('note-count')
    this.noteSave = document.getElementById('note-save')

    document.getElementById('reader-text').textContent = FULL_TEXT
    document.getElementById('reader-cite').textContent = CITATION

    // One source of truth for the three colours: the swatches in the legend
    // and the accents on the gesture buttons are driven from config, so the
    // stylesheet can never drift out of step with what the scene uses.
    const css = ['--mold', '--method', '--aside']
    GESTURE_COLOR.forEach((hex, i) => {
      document.documentElement.style.setProperty(
        css[i], '#' + hex.toString(16).padStart(6, '0'))
    })

    for (const btn of this.gestures.querySelectorAll('[data-gesture]')) {
      btn.addEventListener('click', () => {
        this.h.onGesture?.(Number(btn.dataset.gesture))
      })
    }
    document.getElementById('return').addEventListener('click', () => this.h.onReturn?.())
    this.viewBtn.addEventListener('click', () => this.h.onToggleView?.())
    document.getElementById('legend-btn').addEventListener('click', () => this.toggle('legend'))
    document.getElementById('read').addEventListener('click', () => this.toggle('reader'))
    document.getElementById('notes-btn').addEventListener('click', () => this.h.onOpenNotes?.())

    this.noteText.addEventListener('input', () => this._countNote())
    this.noteForm.addEventListener('submit', (e) => {
      e.preventDefault()
      const text = this.noteText.value
      this.noteSave.disabled = true
      Promise.resolve(this.h.onNote?.(text)).finally(() => {
        this.noteText.value = ''
        this._countNote()
      })
    })
    for (const btn of document.querySelectorAll('[data-close]')) {
      btn.addEventListener('click', () => this.close(btn.dataset.close))
    }

    addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (!this.notes.hidden) return this.close('notes')
        if (!this.reader.hidden) return this.close('reader')
        if (!this.legend.hidden) return this.close('legend')
        this.h.onReturn?.()
      }
      // Shortcuts must not fire while someone is writing a note: "v" would
      // throw them out of their seat mid-sentence and "3" would set the
      // object aside.
      const t = e.target
      if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT')) return
      if (e.key === 'v' || e.key === 'V') this.h.onToggleView?.()
      if (['1', '2', '3'].includes(e.key) && !this.gestures.hidden) {
        this.h.onGesture?.(Number(e.key) - 1)
      }
    })
    this._countNote()
  }

  toggle(id) { this[id].hidden = !this[id].hidden }
  close(id) { this[id].hidden = true }

  /** Show the three choices for a held object. */
  holding(name) {
    this.heldName.textContent = name
    this.gestures.hidden = false
    // The gesture panel and the legend want the same corner, and a passage
    // fragment sitting where the choices are is unreadable. Get out of the way.
    this.legend.hidden = true
    document.body.classList.add('holding')
  }

  released() {
    this.gestures.hidden = true
    document.body.classList.remove('holding')
  }

  setView(seated) {
    this.viewBtn.textContent = seated ? 'Stand and look' : 'Take your seat'
  }

  get modalOpen() { return !this.reader.hidden || !this.notes.hidden }

  _countNote() {
    const n = this.noteText.value.trim().length
    this.noteCount.textContent = `${n} / ${MAX_NOTE}`
    this.noteCount.classList.toggle('over', n >= MAX_NOTE)
    this.noteSave.disabled = n < 2
  }

  /**
   * Show what has been left at a place.
   * @param {object} p
   * @param {number} p.seat        which place
   * @param {boolean} p.isYours    can this visitor write here
   * @param {object[]} p.notes     notes at this place, oldest first
   * @param {string} p.visitorId   to mark which ones are this visitor's own
   * @param {boolean} p.shared     whether other people can see what is written
   */
  showNotes({ seat, isYours, notes, visitorId, shared }) {
    document.getElementById('notes-title').textContent = isYours
      ? 'Your place at the table'
      : `A place at the table`
    document.getElementById('notes-scope').textContent = isYours
      ? (shared ? 'Seat ' + (seat + 1) + ' · anyone who sits here can read this'
                : 'Seat ' + (seat + 1) + ' · kept in this browser only')
      : 'Seat ' + (seat + 1)

    const list = document.getElementById('notes-list')
    list.replaceChildren()
    for (const n of notes) {
      const li = document.createElement('li')
      li.textContent = n.text
      const meta = document.createElement('span')
      meta.className = 'meta'
      const mine = visitorId && n.visitor === visitorId
      meta.textContent = `${whenText(n.at)}${mine ? ' · ' : ''}`
      if (mine) {
        const tag = document.createElement('span')
        tag.className = 'mine'
        tag.textContent = 'yours'
        meta.appendChild(tag)
      }
      li.appendChild(meta)
      list.appendChild(li)
    }

    const empty = document.getElementById('notes-empty')
    empty.hidden = notes.length > 0
    empty.textContent = isYours
      ? 'Nothing here yet. This is your seat — whatever you write stays on the table.'
      : 'Nothing has been left at this place.'

    this.noteForm.hidden = !isYours
    this._countNote()
    this.notes.hidden = false
    if (isYours) this.noteText.focus()
  }
}
