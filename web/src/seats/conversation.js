/**
 * Candid conversation, drawn as filaments between seats.
 *
 * "Importantly, this process does not take place in silence." The gathering is
 * never quiet: strands run continuously between seatmates whether or not you
 * are doing anything. When you commit a gesture, strands fire to the people
 * either side of you, and they may answer with a gesture of their own.
 */
import * as THREE from 'three'

const POOL = 12
const SPEED = 0.55           // filament traversals per second
const ARC = 1.35             // how high a strand lifts over the table

const VERT = /* glsl */`
varying float vT;
void main() {
  vT = uv.x;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const FRAG = /* glsl */`
precision highp float;
varying float vT;
uniform vec3  uColor;
uniform float uHead;
uniform float uFade;
void main() {
  // A travelling pulse with a trailing wake, so a strand reads directionally.
  float d = vT - uHead;
  float pulse = exp(-pow(d / 0.055, 2.0));
  float wake  = smoothstep(0.0, 0.30, -d) * smoothstep(0.34, 0.0, -d) * 0.35;
  float a = (pulse + wake) * uFade;
  if (a < 0.004) discard;
  gl_FragColor = vec4(uColor * (0.55 + a), a);
}
`

export class Conversation {
  constructor({ seats, gathering, onReach }) {
    this.seats = seats
    this.gathering = gathering
    this.onReach = onReach ?? (() => {})
    this.group = new THREE.Group()
    this.group.name = 'Conversation'
    this.slots = []

    for (let i = 0; i < POOL; i++) {
      const material = new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: FRAG,
        uniforms: {
          uColor: { value: new THREE.Color(0xffcf9a) },
          uHead: { value: 0 },
          uFade: { value: 0 },
        },
        transparent: true, depthWrite: false, toneMapped: false,
        blending: THREE.AdditiveBlending,
      })
      const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material)
      mesh.visible = false
      mesh.frustumCulled = false
      this.group.add(mesh)
      this.slots.push({ mesh, material, active: false, t: 0, to: -1, reached: false })
    }
  }

  _freeSlot() {
    return this.slots.find((s) => !s.active) ?? null
  }

  /**
   * Open a strand from one seat to another.
   * @param {number} from seat index
   * @param {number} to seat index
   */
  speak(from, to, color = 0xffcf9a, speed = SPEED) {
    const slot = this._freeSlot()
    if (!slot || from === to) return null
    const a = this.seats[from].position, b = this.seats[to].position
    const mid = new THREE.Vector3()
      .addVectors(a, b).multiplyScalar(0.5)
      .setY(ARC + a.distanceTo(b) * 0.045)

    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(a.x, 1.02, a.z), mid, new THREE.Vector3(b.x, 1.02, b.z))

    slot.mesh.geometry.dispose()
    slot.mesh.geometry = new THREE.TubeGeometry(curve, 40, 0.011, 5, false)
    slot.material.uniforms.uColor.value.set(color)
    slot.material.uniforms.uHead.value = 0
    slot.material.uniforms.uFade.value = 1
    slot.mesh.visible = true
    slot.active = true
    slot.reached = false
    slot.t = 0
    slot.to = to
    slot.speed = speed
    return slot
  }

  /** Ambient chatter between neighbouring seats. */
  murmur(rand) {
    const n = this.seats.length
    const from = Math.floor(rand() * n)
    const near = rand() < 0.78
    const to = near
      ? (from + (rand() < 0.5 ? 1 : n - 1)) % n
      : Math.floor(rand() * n)
    return this.speak(from, to, 0xf0bd85, SPEED * (0.8 + rand() * 0.5))
  }

  update(dt) {
    for (const slot of this.slots) {
      if (!slot.active) continue
      slot.t += dt * slot.speed
      slot.material.uniforms.uHead.value = slot.t
      if (!slot.reached && slot.t >= 0.92) {
        slot.reached = true
        this.gathering?.stir(slot.to, 2.4)
        this.onReach(slot.to)
      }
      if (slot.t > 1.28) {
        slot.material.uniforms.uFade.value = 0
        slot.mesh.visible = false
        slot.active = false
      }
    }
  }

  dispose() {
    for (const s of this.slots) { s.mesh.geometry.dispose(); s.material.dispose() }
  }
}
