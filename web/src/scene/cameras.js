/**
 * Two ways of being at the table, and a damped move between them.
 *
 * Orbit is for reading the topography as a whole — the aerial view is where the
 * record of everyone's gestures becomes legible. Seat view is for being one of
 * the people at the table, with neighbours either side. The passage needs both:
 * it describes a survey and a seat.
 */
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

import { TABLE_TOP } from '../config.js'
import { YOUR_SEAT, seatLayout } from '../seats/layout.js'

const TRANSITION = 1.35   // seconds

export class Cameras {
  constructor(canvas) {
    this.camera = new THREE.PerspectiveCamera(
      42, canvas.clientWidth / Math.max(1, canvas.clientHeight), 0.1, 4000)
    this.camera.position.set(0, 10.0, 10.0)

    this.controls = new OrbitControls(this.camera, canvas)
    this.controls.target.set(0, TABLE_TOP + 0.10, 0)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.06
    this.controls.minDistance = 5.5
    this.controls.maxDistance = 30
    this.controls.maxPolarAngle = Math.PI * 0.495     // never go under the lawn
    this.controls.minPolarAngle = Math.PI * 0.08
    this.controls.update()

    const seat = seatLayout()[YOUR_SEAT]
    this.seatEye = seat.eye.clone()
    this.seatLook = seat.lookAt.clone()

    this.mode = 'orbit'
    this.t = 1
    this.from = { pos: new THREE.Vector3(), target: new THREE.Vector3() }
    this.to = { pos: new THREE.Vector3(), target: new THREE.Vector3() }
    this.orbitMemo = {
      pos: this.camera.position.clone(),
      target: this.controls.target.clone(),
    }
  }

  get seated() { return this.mode === 'seat' }

  toggle() { this.setMode(this.mode === 'orbit' ? 'seat' : 'orbit') }

  setMode(mode) {
    if (mode === this.mode && this.t >= 1) return
    if (this.mode === 'orbit') {
      this.orbitMemo.pos.copy(this.camera.position)
      this.orbitMemo.target.copy(this.controls.target)
    }
    this.mode = mode
    this.from.pos.copy(this.camera.position)
    this.from.target.copy(this.controls.target)
    if (mode === 'seat') {
      this.to.pos.copy(this.seatEye)
      this.to.target.copy(this.seatLook)
    } else {
      this.to.pos.copy(this.orbitMemo.pos)
      this.to.target.copy(this.orbitMemo.target)
    }
    this.t = 0
    this.controls.enabled = false
  }

  update(dt) {
    if (this.t < 1) {
      this.t = Math.min(1, this.t + dt / TRANSITION)
      const e = this.t < 0.5
        ? 4 * this.t ** 3
        : 1 - Math.pow(-2 * this.t + 2, 3) / 2       // easeInOutCubic
      this.camera.position.lerpVectors(this.from.pos, this.to.pos, e)
      this.controls.target.lerpVectors(this.from.target, this.to.target, e)
      this.camera.lookAt(this.controls.target)
      if (this.t >= 1) {
        // Seated, you may look around but not fly off; orbiting is unrestricted.
        this.controls.enabled = true
        this.controls.minDistance = this.mode === 'seat' ? 0.4 : 5.5
        this.controls.maxDistance = this.mode === 'seat' ? 4.2 : 30
      }
    } else {
      this.controls.update()
    }
  }

  resize(width, height) {
    this.camera.aspect = width / Math.max(1, height)
    this.camera.updateProjectionMatrix()
  }
}
