/**
 * Loads the three .glb files produced by blender/build_all.py and hands back
 * the named pieces the rest of the runtime expects.
 */
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const BASE = import.meta.env?.BASE_URL ?? './'

function url(name) {
  return `${BASE}models/${name}.glb`.replace(/([^:])\/\//g, '$1/')
}

function collect(root) {
  const byName = new Map()
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true
      o.receiveShadow = true
      byName.set(o.name, o)
    }
  })
  return byName
}

export async function loadAssets() {
  const loader = new GLTFLoader()
  const load = (n) => loader.loadAsync(url(n))
  const [tableGltf, quadGltf, objectsGltf] = await Promise.all(
    ['table', 'quad', 'objects'].map(load))

  const t = collect(tableGltf.scene)
  const q = collect(quadGltf.scene)
  const o = collect(objectsGltf.scene)

  const objects = []
  for (let i = 0; i < 9; i++) {
    const mesh = o.get(`AIObject_${String(i).padStart(2, '0')}`)
    if (mesh) objects.push(mesh)
  }

  // The lawn should take shadow but not cast it onto itself.
  const ground = q.get('Ground')
  if (ground) ground.castShadow = false
  const paths = q.get('Paths')
  if (paths) paths.castShadow = false
  // Lit windows are emissive; shadowing them would only cost fill rate.
  const windows = q.get('QuadWindows')
  if (windows) { windows.castShadow = false; windows.receiveShadow = false }

  return {
    table: t.get('Table'),
    chair: t.get('Chair'),
    quad: q.get('Quad'),
    windows, ground, paths,
    objects,
    roots: { table: tableGltf.scene, quad: quadGltf.scene, objects: objectsGltf.scene },
  }
}
