/**
 * Loads the three .glb files produced by blender/build_all.py and hands back
 * the named pieces the rest of the runtime expects.
 */
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
  const [tableGltf, quadGltf, objectsGltf] = await Promise.all(
    ['table', 'quad', 'objects'].map((n) => loader.loadAsync(url(n))))

  const t = collect(tableGltf.scene)
  const q = collect(quadGltf.scene)
  const o = collect(objectsGltf.scene)

  const objects = []
  for (let i = 0; i < 10; i++) {
    const mesh = o.get(`AIObject_${String(i).padStart(2, '0')}`)
    if (mesh) objects.push(mesh)
  }

  // Trees come as trunk/canopy pairs and are instanced around the Quad.
  const trees = []
  for (const [name, mesh] of q) {
    const m = /^TreeTrunk_(\d+)$/.exec(name)
    if (!m) continue
    const canopy = q.get(`TreeCanopy_${m[1]}`)
    if (canopy) trees.push({ trunk: mesh, canopy })
  }

  // The prototypes live at the origin — right where the table is. They exist
  // only to be instanced, so detach them from the scene graph we add.
  for (const { trunk, canopy } of trees) {
    trunk.removeFromParent()
    canopy.removeFromParent()
  }

  const lawn = q.get('Lawn')
  if (lawn) lawn.castShadow = false            // it has nothing to cast onto
  const paths = q.get('Paths')
  if (paths) paths.castShadow = false

  return {
    table: t.get('Table'),
    chair: t.get('Chair'),
    quad: q.get('Quad'),
    glass: q.get('QuadGlass'),
    lawn, paths, trees, objects,
    roots: { table: tableGltf.scene, quad: quadGltf.scene, objects: objectsGltf.scene },
  }
}
