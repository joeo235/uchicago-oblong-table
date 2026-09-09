/**
 * The Oblong Table — entry point.
 *
 * Builds the Quad, the table, and the live heightfield; replays the gathering
 * already in progress; then hands over. From that point the scene runs whether
 * or not anyone touches it, because the passage is explicit that the table
 * keeps shifting on its own.
 */
import * as THREE from 'three'

import { GESTURE, TABLE_TOP } from './config.js'
import { ObjectField } from './objects/aiObjects.js'
import { Gestures } from './objects/gestures.js'
import { loadAssets } from './scene/assets.js'
import { Cameras } from './scene/cameras.js'
import { addLighting } from './scene/lighting.js'
import { createStage } from './scene/stage.js'
import { Conversation } from './seats/conversation.js'
import { YOUR_SEAT, neighboursOf, seatLayout } from './seats/layout.js'
import { Gathering } from './seats/seats.js'
import { Students } from './seats/students.js'
import { createTableSurface } from './table/tableMesh.js'
import { Topography } from './table/topography.js'
import { loadHistory, saveHistory } from './state/persistence.js'
import { prng, seedMarks } from './state/seed.js'
import { Overlay } from './ui/overlay.js'
import { HintDisplay, PassageDisplay } from './ui/passage.js'

const OBJECT_NAMES = [
  'lattice knot', 'plate stack', 'ring spiral', 'rod cluster', 'folded ribbon',
  'faceted seed', 'nested cage', 'filament bundle', 'torus weave',
]

const canvas = document.getElementById('stage')
// Timer replaces the deprecated Clock in r186. It has no delta clamp of its
// own, so a backgrounded tab would otherwise return one enormous step.
const timer = new THREE.Timer()

/** Fewer triangles and a lower pixel ratio where the GPU cannot carry it. */
function detectQuality(renderer) {
  const gl = renderer.getContext()
  const dbg = gl.getExtension('WEBGL_debug_renderer_info')
  const name = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : ''
  const mobile = /iPhone|iPad|Android/i.test(navigator.userAgent)
  const weak = mobile || /Mali|Adreno|PowerVR|SwiftShader|llvmpipe/i.test(name)
  return { quality: weak ? 0.4 : 1.0, weak, renderer: name }
}

async function boot() {
  const { renderer, scene } = createStage(canvas)
  const cameras = new Cameras(canvas)
  addLighting(scene)

  const caps = detectQuality(renderer)
  if (caps.weak) renderer.setPixelRatio(1)

  const assets = await loadAssets()
  scene.add(assets.roots.quad, assets.table)

  const seats = seatLayout()
  scene.add(buildChairs(assets.chair, seats))

  // ---------------------------------------------------------------- surface
  const topography = new Topography(renderer)
  const surface = createTableSurface(topography, caps.quality)
  scene.add(surface)

  const passage = new PassageDisplay(document.getElementById('passage'))
  const hint = new HintDisplay(document.getElementById('hint'))

  // ------------------------------------------------------- the gathering
  const gathering = new Gathering({
    topography,
    onAct: (mark, seatIndex) => {
      const [a, b] = neighboursOf(seatIndex, seats.length)
      conversation.speak(seatIndex, Math.random() < 0.5 ? a : b)
      if (Math.random() < 0.22) passage.show('neighbour')
    },
  })
  scene.add(gathering.group)

  const conversation = new Conversation({ seats, gathering })
  scene.add(conversation.group)

  const students = new Students({
    topography, passage,
    onArrive: () => { for (const i of [YOUR_SEAT, 3, 17]) gathering.stir(i, 2.2) },
  })
  scene.add(students.group)

  // ------------------------------------------------------------- objects
  const field = new ObjectField(assets.objects, topography)
  scene.add(field.group)

  // Replay the gathering already under way, then your own past visits.
  const history = loadHistory()
  topography.stamp(seedMarks())
  topography.stamp(history.map((m) => ({ ...m, aged: true })))
  topography.flush()
  const yourMarks = [...history]

  // -------------------------------------------------------------- gestures
  const gestures = new Gestures({
    topography, field, passage, hint,
    onCommit: (mark) => {
      yourMarks.push(mark)
      saveHistory(yourMarks)
      overlay.released()
      // You act, and the people either side of you hear about it.
      const [a, b] = neighboursOf(YOUR_SEAT, seats.length)
      conversation.speak(YOUR_SEAT, a)
      conversation.speak(YOUR_SEAT, b)
      // ...and one of them may answer with a gesture of their own.
      setTimeout(() => gathering.act(Math.random() < 0.5 ? a : b),
        1600 + Math.random() * 2600)
    },
  })

  const overlay = new Overlay({
    onGesture: (g) => {
      if (!gestures.active) return
      gestures.begin(g)
      if (g === GESTURE.ASIDE) overlay.released()
    },
    onReturn: () => { gestures.putBack(); overlay.released() },
    onToggleView: () => { cameras.toggle(); overlay.setView(!cameras.seated) },
  })

  wirePointer({ canvas, cameras, surface, field, gestures, overlay, hint })

  // ------------------------------------------------------------------ loop
  const ambient = prng(1312)
  let murmurIn = 2.0
  let driftHintAt = 26

  const fit = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h, false)
    cameras.resize(w, h)
  }
  new ResizeObserver(fit).observe(canvas)
  fit()

  document.getElementById('loading').classList.add('done')
  document.getElementById('ui').hidden = false
  passage.show('arrive')

  let elapsed = 0
  renderer.setAnimationLoop(() => {
    timer.update()
    const dt = Math.min(timer.getDelta(), 0.05)
    elapsed += dt

    topography.update(dt)
    surface.userData.uniforms.uTopo.value = topography.texture

    field.update(dt, elapsed, gestures.held)
    gathering.update(dt, elapsed)
    conversation.update(dt)
    students.update(dt)

    // The room is never silent.
    murmurIn -= dt
    if (murmurIn <= 0) {
      murmurIn = 1.4 + ambient() * 3.2
      conversation.murmur(ambient)
    }

    if (elapsed > driftHintAt) { driftHintAt = Infinity; passage.show('drift') }

    cameras.update(dt)
    renderer.render(scene, cameras.camera)
  })

  window.__oblong = {
    THREE, scene, renderer, cameras, topography, surface, field, gestures,
    gathering, conversation, students, seats, caps, overlay,
    yourMarks, elapsed: () => elapsed,
  }
}

/** 28 chairs from a single mesh, each turned to face the table. */
function buildChairs(proto, seats) {
  const chairs = new THREE.InstancedMesh(proto.geometry, proto.material, seats.length)
  chairs.castShadow = true
  chairs.receiveShadow = true
  const m = new THREE.Matrix4()
  seats.forEach((s, i) => {
    m.makeRotationY(s.rotationY)
    m.setPosition(s.position.x, 0, s.position.z)
    chairs.setMatrixAt(i, m)
  })
  chairs.instanceMatrix.needsUpdate = true
  chairs.name = 'Chairs'
  return chairs
}

/** Hover, take, position, commit. */
function wirePointer({ canvas, cameras, surface, field, gestures, overlay, hint }) {
  const ray = new THREE.Raycaster()
  const ndc = new THREE.Vector2()
  let hover = null

  const toNdc = (e) => {
    const r = canvas.getBoundingClientRect()
    ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1
    ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1
  }

  // The surface is displaced on the GPU, so raycasting its flat geometry would
  // miss. Intersect the table plane instead and read the CPU mirror for height.
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TABLE_TOP)
  const hitPoint = new THREE.Vector3()

  canvas.addEventListener('pointermove', (e) => {
    toNdc(e)
    ray.setFromCamera(ndc, cameras.camera)

    if (gestures.mode) {
      if (ray.ray.intersectPlane(plane, hitPoint)) gestures.pointerAt(hitPoint)
      return
    }
    if (gestures.active) return

    const hits = ray.intersectObjects(field.meshes, false)
    const next = hits.length ? hits[0].object.userData.item : null
    if (next !== hover) {
      hover = next
      canvas.style.cursor = hover ? 'pointer' : 'default'
      hint.set(hover
        ? (hover.state === 'aside' ? 'set aside' : 'click to pick it up')
        : null)
    }
  })

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || overlay.modalOpen) return
    toNdc(e)
    ray.setFromCamera(ndc, cameras.camera)

    if (gestures.mode) {
      if (ray.ray.intersectPlane(plane, hitPoint)) gestures.pointerAt(hitPoint)
      gestures.confirm()
      return
    }
    if (gestures.active) return

    const hits = ray.intersectObjects(field.meshes, false)
    if (!hits.length) return
    const item = hits[0].object.userData.item
    if (gestures.take(item)) {
      overlay.holding(OBJECT_NAMES[item.archetype])
      hint.set(null)
    }
  })
}

boot().catch((err) => {
  console.error('[oblong] boot failed', err)
  const el = document.getElementById('loading')
  if (el) el.textContent = 'Could not set the table — see console.'
})
