/**
 * The three things a person at this table can do with an AI object.
 *
 * The passage lists them without ranking them, and this module is written to
 * keep it that way: each path takes comparable effort, commits the same way,
 * leaves a mark of comparable size, and gets its own line of the passage. There
 * is no success state and nothing to accumulate.
 */
import * as THREE from 'three'

import { FIELD_DEP, FIELD_LEN, GESTURE, TABLE_TOP } from '../config.js'

const SNAP = 0.30            // grid step for a methodical placement

export class Gestures {
  constructor({ topography, field, passage, hint, onCommit }) {
    this.topography = topography
    this.field = field
    this.passage = passage
    this.hint = hint
    this.onCommit = onCommit ?? (() => {})

    this.held = null
    this.mode = null                       // null | 'mold' | 'place'
    this.pointer = new THREE.Vector3()
    this.dragStart = new THREE.Vector3()
    this.dragAmount = 0
    this.lock = new THREE.Vector3()
  }

  get active() { return this.held !== null }

  take(item) {
    if (this.held || item.state === 'aside') return false
    this.held = item
    this.field.setState(item, 'held')
    this.origin = item.target.clone()
    this.passage.show('take')
    return true
  }

  putBack() {
    if (!this.held) return
    const item = this.held
    item.target.set(this.origin.x, TABLE_TOP, this.origin.z)
    this.field.setState(item, 'loose')
    this._reset()
  }

  /** Enter a placement mode, or — for setting aside — commit straight away. */
  begin(gesture) {
    if (!this.held) return
    if (gesture === GESTURE.ASIDE) return this._commitAside()
    this.mode = gesture === GESTURE.MOLD ? 'mold' : 'place'
    this.dragAmount = 0
    this.dragStart.copy(this.held.mesh.position)
    this.lock.set(0, 0, 0)
    this.hint.set(this.mode === 'mold'
      ? 'Move to work it — click to commit'
      : 'Position precisely — click to place')
  }

  /** Called while a placement mode is live, with the point under the cursor. */
  pointerAt(point) {
    if (!this.held || !this.mode) return
    const half = { x: FIELD_LEN / 2 - 0.25, z: FIELD_DEP / 2 - 0.20 }
    let x = THREE.MathUtils.clamp(point.x, -half.x, half.x)
    let z = THREE.MathUtils.clamp(point.z, -half.z, half.z)

    if (this.mode === 'place') {
      x = Math.round(x / SNAP) * SNAP
      z = Math.round(z / SNAP) * SNAP
    }
    this.pointer.set(x, 0, z)

    const mesh = this.held.mesh
    mesh.position.x += (x - mesh.position.x) * 0.35
    mesh.position.z += (z - mesh.position.z) * 0.35
    mesh.position.y += (this.field.surfaceY(x, z) + 0.22 - mesh.position.y) * 0.25

    if (this.mode === 'mold') {
      // Working it leaves a record in the object: how far and which way you
      // pushed becomes the shape it keeps.
      const d = new THREE.Vector3(x, 0, z).sub(this.dragStart)
      this.dragAmount = Math.min(1, this.dragAmount + d.length() * 0.006)
      this.lock.set(d.x * 0.22, this.dragAmount * 1.6, d.z * 0.22)
      this.held.uniforms.uLock.value.copy(this.lock)
      this.held.uniforms.uMorph.value = 0.030 + this.dragAmount * 0.055
    }
  }

  confirm() {
    if (!this.held || !this.mode) return
    return this.mode === 'mold' ? this._commitMold() : this._commitPlace()
  }

  _commitMold() {
    const item = this.held
    const { x, z } = this.pointer
    const spread = 0.52 + this.dragAmount * 0.46
    const mark = {
      x, z, grammar: GESTURE.MOLD,
      radius: spread,
      amp: 0.115 + this.dragAmount * 0.075,
      seed: Math.random(),
    }
    this.topography.stamp([mark])
    item.target.set(x, TABLE_TOP, z)
    this.field.setState(item, 'molded', {
      lock: this.lock.clone(),
      morph: 0.034 + this.dragAmount * 0.048,
    })
    this.passage.show('mold')
    this._finish(mark)
  }

  _commitPlace() {
    const item = this.held
    const { x, z } = this.pointer
    const mark = {
      x, z, grammar: GESTURE.METHOD,
      radius: 0.46,
      amp: 0.135,
      seed: Math.random(),
    }
    this.topography.stamp([mark])
    item.target.set(x, TABLE_TOP, z)
    item.mesh.rotation.y = Math.round(item.mesh.rotation.y / (Math.PI / 8)) * (Math.PI / 8)
    this.field.setState(item, 'placed')
    this.passage.show('method')
    this._finish(mark)
  }

  _commitAside() {
    const item = this.held
    // The mark stays where the object was handled and considered. Setting a
    // thing aside is a decision that happened somewhere, and it leaves a trace.
    const x = this.origin.x
    const z = this.origin.z
    const mark = {
      x, z, grammar: GESTURE.ASIDE,
      radius: 0.50,
      amp: 0.130,
      seed: Math.random(),
    }
    this.topography.stamp([mark])

    const slot = this.field.claimRimSlot()
    item.target.set(slot.x, TABLE_TOP, slot.y)
    this.field.setState(item, 'aside')
    this.passage.show('aside')
    this._finish(mark)
  }

  _finish(mark) {
    const item = this.held
    this._reset()
    this.onCommit(mark, item)
  }

  _reset() {
    this.held = null
    this.mode = null
    this.dragAmount = 0
    this.hint.set(null)
  }
}
