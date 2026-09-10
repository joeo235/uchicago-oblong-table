/**
 * The three things a person at this table can do with an AI object.
 *
 * The passage lists them without ranking them, and this module keeps it that
 * way: each path takes comparable effort, commits the same way, changes the
 * arrangement by a comparable amount, and gets its own line of the passage.
 * There is no success state and nothing to accumulate.
 */
import * as THREE from 'three'

import { FIELD_DEP, FIELD_LEN, GESTURE, TABLE_TOP } from '../config.js'

export class Gestures {
  constructor({ field, passage, hint, onCommit }) {
    this.field = field
    this.passage = passage
    this.hint = hint
    this.onCommit = onCommit ?? (() => {})

    this.held = null
    this.mode = null                    // null | 'mold' | 'place'
    this.pointer = new THREE.Vector3()
    this.origin = new THREE.Vector3()
    this.worked = 0                     // how much this object has been worked
  }

  get active() { return this.held !== null }

  take(item) {
    if (this.held || item.state === 'aside') return false
    this.held = item
    item.held = true                   // it is in the air now: nothing rests on it
    this.origin.copy(item.target)
    item.glow = 1.6
    this.field.settle()
    this.passage.show('take')
    return true
  }

  putBack() {
    if (!this.held) return
    const it = this.held
    it.held = false
    it.target.copy(this.origin)
    if (it.state === 'molded') {
      it.target.y = this.field.supportY(it.target.x, it.target.z, it)
    }
    it.glow = it.state === 'loose' ? 1 : it.glow
    this.field.settle()
    this._reset()
  }

  begin(gesture) {
    if (!this.held) return
    if (gesture === GESTURE.ASIDE) return this._commitAside()
    this.mode = gesture === GESTURE.MOLD ? 'mold' : 'place'
    this.worked = 0
    this.pointer.copy(this.held.target)
    this.hint.set(this.mode === 'mold'
      ? 'Work it across the table — click to commit'
      : 'Position it precisely — click to place')
  }

  /** Called while a placement mode is live, with the point under the cursor. */
  pointerAt(point) {
    if (!this.held || !this.mode) return
    const hx = FIELD_LEN / 2 - 0.25, hz = FIELD_DEP / 2 - 0.20
    let x = THREE.MathUtils.clamp(point.x, -hx, hx)
    let z = THREE.MathUtils.clamp(point.z, -hz, hz)
    if (this.mode === 'place') {
      x = Math.round(x / 0.34) * 0.34
      z = Math.round(z / 0.34) * 0.34
    }

    if (this.mode === 'mold') {
      // Working it shows: the more you move it, the more it grows and turns.
      this.worked = Math.min(1, this.worked
        + Math.hypot(x - this.pointer.x, z - this.pointer.z) * 0.55)
      const it = this.held
      it.mesh.scale.setScalar(1 + this.worked * 0.55)
      it.mesh.rotation.y += 0.05 * this.worked
      it.uniforms.uMorph.value = 0.006 + this.worked * 0.012
    }

    this.pointer.set(x, 0, z)
    const mesh = this.held.mesh
    const lift = TABLE_TOP + 0.24 + this.field.supportY(x, z, this.held) - TABLE_TOP
    mesh.position.x += (x - mesh.position.x) * 0.35
    mesh.position.z += (z - mesh.position.z) * 0.35
    mesh.position.y += (lift - mesh.position.y) * 0.28
  }

  confirm() {
    if (!this.held || !this.mode) return
    return this.mode === 'mold' ? this._commitMold() : this._commitPlace()
  }

  _commitMold() {
    const it = this.held
    const r = this.field.mold(it, this.pointer.x, this.pointer.z)
    it.scale *= 1 + this.worked * 0.28
    this.passage.show('mold')
    this._finish(r, it)
  }

  _commitPlace() {
    const it = this.held
    const r = this.field.place(it, this.pointer.x, this.pointer.z)
    this.passage.show('method')
    this._finish(r, it)
  }

  _commitAside() {
    const it = this.held
    const r = this.field.setAside(it)
    this.passage.show('aside')
    this._finish(r, it)
  }

  _finish(result, item) {
    item.held = false
    this._reset()
    this.onCommit({ ...result, objectIndex: item.index }, item)
  }

  _reset() {
    this.held = null
    this.mode = null
    this.worked = 0
    this.hint.set(null)
  }
}
