/**
 * The Oblong Table — entry point.
 *
 * Builds the Quad and the table, scatters the AI objects, replays the
 * gathering that is already in progress, then hands over. From that point the
 * arrangement keeps changing whether or not anyone touches it: colleagues go
 * on deciding about things, and students keep shifting what has settled.
 */
import * as THREE from 'three'

import { NOTES_API, OBJECT_NAMES, TABLE_TOP } from './config.js'
import { ObjectField } from './objects/aiObjects.js'
import { Gestures } from './objects/gestures.js'
import { loadAssets } from './scene/assets.js'
import { Cameras } from './scene/cameras.js'
import { addLighting } from './scene/lighting.js'
import { createStage } from './scene/stage.js'
import { plantTrees } from './scene/trees.js'
import { Conversation } from './seats/conversation.js'
import { neighboursOf, seatLayout, yourSeat } from './seats/layout.js'
import { Gathering } from './seats/seats.js'
import { Students } from './seats/students.js'
import { visitorId } from './state/identity.js'
import { LocalNotes, bySeat } from './state/notes.js'
import { createNoteStore } from './state/notesRemote.js'
import { loadHistory, saveHistory } from './state/persistence.js'
import { prng, seedActions } from './state/seed.js'
import { Overlay } from './ui/overlay.js'
import { HintDisplay, PassageDisplay } from './ui/passage.js'

const canvas = document.getElementById('stage')
// Timer replaces the deprecated Clock in r186. It has no delta clamp of its
// own, so a backgrounded tab would otherwise return one enormous step.
const timer = new THREE.Timer()

/** Fewer instances and a lower pixel ratio where the GPU cannot carry it. */
function detectQuality(renderer) {
  const gl = renderer.getContext()
  const dbg = gl.getExtension('WEBGL_debug_renderer_info')
  const name = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : ''
  const mobile = /iPhone|iPad|Android/i.test(navigator.userAgent)
  const weak = mobile || /Mali|Adreno|PowerVR|SwiftShader|llvmpipe/i.test(name)
  return { weak, renderer: name }
}

async function boot() {
  const { renderer, scene, sky } = createStage(canvas)
  const cameras = new Cameras(canvas)
  const lights = addLighting(scene)

  const caps = detectQuality(renderer)
  if (caps.weak) {
    renderer.setPixelRatio(1)
    lights.sun.shadow.mapSize.set(1024, 1024)
  }

  const assets = await loadAssets()
  scene.add(assets.roots.quad, assets.table)
  scene.add(plantTrees(assets.trees))

  const seats = seatLayout()
  scene.add(buildChairs(assets.chair, seats))

  const passage = new PassageDisplay(document.getElementById('passage'))
  const hint = new HintDisplay(document.getElementById('hint'))

  // ------------------------------------------------------------- objects
  const field = new ObjectField(assets.objects)
  scene.add(field.group)

  // --------------------------------------------------------- the gathering
  const gathering = new Gathering({
    field,
    onAct: (_result, seatIndex) => {
      const [a, b] = neighboursOf(seatIndex, seats.length)
      conversation.speak(seatIndex, Math.random() < 0.5 ? a : b)
      if (Math.random() < 0.22) passage.show('neighbour')
    },
  })
  scene.add(gathering.group)

  const conversation = new Conversation({ seats, gathering })
  scene.add(conversation.group)

  const students = new Students({
    field, passage,
    onArrive: () => { for (const i of [yourSeat(), 4, 18]) gathering.stir(i, 2.4) },
  })
  scene.add(students.group)

  // Replay the gathering already under way, then your own past visits.
  const history = loadHistory()
  const replay = (a) => {
    const item = field.items[a.objectIndex]
    // noStack: the table you arrive at has nothing balanced on anything else.
    if (item) field.apply(item, a.gesture, a.x, a.z, { noStack: true })
  }
  seedActions().forEach(replay)
  history.forEach(replay)
  // Guarantee the table you arrive at has nothing sitting on, or inside,
  // anything else. Placement tries to find room; this checks that it did.
  field.separate({ flatten: true })
  for (const it of field.items) it.pos.copy(it.target)
  const yourActions = [...history]

  // -------------------------------------------------------------- gestures
  const gestures = new Gestures({
    field, passage, hint,
    onCommit: (action) => {
      yourActions.push(action)
      saveHistory(yourActions)
      overlay.released()
      const [a, b] = neighboursOf(yourSeat(), seats.length)
      conversation.speak(yourSeat(), a)
      conversation.speak(yourSeat(), b)
      // ...and one of them may answer with a gesture of their own.
      setTimeout(() => gathering.act(Math.random() < 0.5 ? a : b),
        1600 + Math.random() * 2600)
    },
  })

  // ----------------------------------------------------------------- notes
  // What people leave at their place. The store is an interface: this one
  // keeps notes in the browser, so they are yours across your own visits and
  // nobody else's. A shared store needs somewhere hosted and implements the
  // same two methods.
  const notes = createNoteStore(NOTES_API, LocalNotes)
  const me = { seat: yourSeat(), id: visitorId() }
  let noteIndex = new Map()

  const refreshNotes = async () => {
    noteIndex = bySeat(await notes.list())
    gathering.setNotes(noteIndex)
  }

  const openNotes = (seat) => {
    overlay.showNotes({
      seat,
      isYours: seat === me.seat,
      notes: noteIndex.get(seat) ?? [],
      visitorId: me.id,
      shared: notes.shared,
      error: notes.lastError,
    })
  }

  const overlay = new Overlay({
    onGesture: (g) => {
      if (!gestures.active) return
      gestures.begin(g)
      if (g === 2) overlay.released()
    },
    onReturn: () => { gestures.putBack(); overlay.released() },
    onToggleView: () => { cameras.toggle(); overlay.setView(!cameras.seated) },
    onOpenNotes: () => openNotes(me.seat),
    onNote: async (text) => {
      const saved = await notes.add({ seat: me.seat, text, visitor: me.id })
      if (!saved) { openNotes(me.seat); return }   // show why it did not land
      await refreshNotes()
      openNotes(me.seat)
      // Leaving a note is an act of conversation, so it travels like one.
      passage.show('neighbour', { force: true })
      const [a, b] = neighboursOf(me.seat, seats.length)
      conversation.speak(me.seat, a)
      conversation.speak(me.seat, b)
      gathering.stir(me.seat, 2.6)
    },
  })

  await refreshNotes()

  wirePointer({ canvas, cameras, field, gestures, overlay, hint, gathering, openNotes, me })

  // ------------------------------------------------------------------ loop
  const ambient = prng(1312)
  let murmurIn = 2.0
  let driftHintAt = 30

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
    sky.position.copy(cameras.camera.position)   // never clip the dome
    renderer.render(scene, cameras.camera)
  })

  window.__oblong = {
    THREE, scene, renderer, cameras, field, gestures, gathering,
    conversation, students, seats, assets, caps, overlay, passage,
    yourActions, notes, me, openNotes, refreshNotes,
    noteIndex: () => noteIndex,
    elapsed: () => elapsed,
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

/** Hover, take, position, commit — and read what was left at a place. */
function wirePointer({ canvas, cameras, field, gestures, overlay, hint, gathering, openNotes, me }) {
  const ray = new THREE.Raycaster()
  const ndc = new THREE.Vector2()
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TABLE_TOP)
  const hitPoint = new THREE.Vector3()
  let hover = null
  let hoverBook = null

  /** Which place's notebook is under the cursor, if any. */
  const pickNotebook = (r) => {
    const hits = r.intersectObject(gathering.paper, false)
    return hits.length && hits[0].instanceId !== undefined ? hits[0].instanceId : null
  }

  const toNdc = (e) => {
    const r = canvas.getBoundingClientRect()
    ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1
    ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1
  }

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
    const book = next ? null : pickNotebook(ray)
    if (next !== hover || book !== hoverBook) {
      hover = next
      hoverBook = book
      canvas.style.cursor = (hover || book !== null) ? 'pointer' : 'default'
      hint.set(hover
        ? `${OBJECT_NAMES[hover.archetype]} — ${hover.state === 'aside'
          ? 'set aside' : 'click to pick it up'}`
        : book !== null
          ? (book === me.seat
            ? 'your notebook — click to write'
            : gathering.hasNotes(book)
              ? 'a notebook with writing in it — click to read'
              : 'an empty notebook')
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
    if (hits.length) {
      const item = hits[0].object.userData.item
      if (gestures.take(item)) {
        overlay.holding(OBJECT_NAMES[item.archetype])
        hint.set(null)
      }
      return
    }
    const book = pickNotebook(ray)
    if (book !== null) openNotes(book)
  })
}

boot().catch((err) => {
  console.error('[oblong] boot failed', err)
  const el = document.getElementById('loading')
  if (el) el.textContent = 'Could not set the table — see console.'
})
