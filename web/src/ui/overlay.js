/**
 * The DOM layer: gesture panel, legend, reader, and the view toggle.
 *
 * The three gesture buttons are laid out identically on purpose. Nothing in
 * this file should give one of them more prominence than the others.
 */
import { GESTURE_COLOR } from '../config.js'
import { CITATION, FULL_TEXT } from './passage.js'

export class Overlay {
  constructor(handlers) {
    this.h = handlers
    this.root = document.getElementById('ui')
    this.gestures = document.getElementById('gestures')
    this.heldName = document.getElementById('held-name')
    this.legend = document.getElementById('legend')
    this.reader = document.getElementById('reader')
    this.viewBtn = document.getElementById('view')

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
    for (const btn of document.querySelectorAll('[data-close]')) {
      btn.addEventListener('click', () => this.close(btn.dataset.close))
    }

    addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (!this.reader.hidden) return this.close('reader')
        if (!this.legend.hidden) return this.close('legend')
        this.h.onReturn?.()
      }
      if (e.key === 'v' || e.key === 'V') this.h.onToggleView?.()
      if (['1', '2', '3'].includes(e.key) && !this.gestures.hidden) {
        this.h.onGesture?.(Number(e.key) - 1)
      }
    })
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

  get modalOpen() { return !this.reader.hidden }
}
