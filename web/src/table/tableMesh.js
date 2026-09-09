/**
 * The visible table surface: a dense plane displaced by the topography target.
 *
 * Rather than write a material from scratch, this patches MeshStandardMaterial
 * so the relief keeps real PBR lighting, shadows and tone mapping. A matching
 * depth material carries the same displacement, so the topography casts its own
 * shadows instead of shadowing as a flat slab.
 */
import * as THREE from 'three'

import { FIELD_DEP, FIELD_LEN, GESTURE_COLOR, TABLE_TOP } from '../config.js'

const PARS = /* glsl */`
uniform sampler2D uTopo;
uniform vec2  uField;
uniform vec2  uTexel;
varying vec2  vTopoUv;
varying vec4  vTopo;
`

const DISPLACE = /* glsl */`
  vTopoUv = uv;
  vTopo = texture2D(uTopo, uv);
  transformed += normal * vTopo.r;
`

/** Three taps, converted from uv steps into world distance, then a cross product. */
const RENORMAL = /* glsl */`
  {
    float h  = texture2D(uTopo, uv).r;
    float hx = texture2D(uTopo, uv + vec2(uTexel.x, 0.0)).r;
    float hz = texture2D(uTopo, uv + vec2(0.0, uTexel.y)).r;
    float dx = uField.x * uTexel.x;
    float dz = uField.y * uTexel.y;
    objectNormal = normalize(vec3(-(hx - h) / dx, 1.0, -(hz - h) / dz));
  }
`

function grammarTintGlsl() {
  const c = GESTURE_COLOR.map((hex) => {
    const col = new THREE.Color(hex).convertSRGBToLinear()
    return `vec3(${col.r.toFixed(4)}, ${col.g.toFixed(4)}, ${col.b.toFixed(4)})`
  })
  // Four stops: mold, method, set aside, and the shift that came from students.
  return /* glsl */`
    vec3 grammarTint(float g) {
      vec3 stops[4];
      stops[0] = ${c[0]};
      stops[1] = ${c[1]};
      stops[2] = ${c[2]};
      stops[3] = ${c[3]};
      float t = clamp(g, 0.0, 1.0) * 3.0;
      int i = int(floor(t));
      i = min(i, 2);
      return mix(stops[i], stops[i + 1], t - float(i));
    }
  `
}

export function createTableSurface(topography, quality = 1.0) {
  const segX = Math.max(96, Math.round(512 * quality))
  const segZ = Math.max(24, Math.round(128 * quality))
  const geometry = buildFieldGeometry(segX, segZ)

  const uniforms = {
    uTopo: { value: topography.texture },
    uField: { value: new THREE.Vector2(FIELD_LEN, FIELD_DEP) },
    uTexel: { value: new THREE.Vector2(1 / 1024, 1 / 224) },
  }

  const material = new THREE.MeshStandardMaterial({
    color: 0x4a382a, roughness: 0.62, metalness: 0.03,
  })
  material.customProgramCacheKey = () => 'oblong-table-surface'
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${PARS}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${DISPLACE}`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>\n${RENORMAL}`)

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${PARS}\n${grammarTintGlsl()}`)
      .replace('#include <color_fragment>', /* glsl */`
        #include <color_fragment>
        // Where the surface is bare, it stays oak. A mark declares itself only
        // as far as it actually rises or dips.
        float presence = smoothstep(0.022, 0.095, abs(vTopo.r));
        vec3 tint = grammarTint(clamp(vTopo.g, 0.0, 1.0));
        diffuseColor.rgb = mix(diffuseColor.rgb, tint * 0.36, presence * 0.36);
      `)
      .replace('#include <roughnessmap_fragment>', /* glsl */`
        #include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.34, vTopo.a * 0.55);
      `)
      .replace('#include <emissivemap_fragment>', /* glsl */`
        #include <emissivemap_fragment>
        // A gesture just made still glows; it settles over about 45 seconds.
        float fresh = 1.0 - clamp(vTopo.b, 0.0, 1.0);
        float pres = smoothstep(0.008, 0.05, abs(vTopo.r));
        totalEmissiveRadiance += grammarTint(clamp(vTopo.g, 0.0, 1.0))
                               * pow(fresh, 1.6) * pres * 0.55;
      `)
  }

  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.y = TABLE_TOP
  mesh.receiveShadow = true
  mesh.castShadow = true
  mesh.name = 'TableSurface'
  mesh.frustumCulled = false

  // Same displacement in the shadow pass, or the relief would cast flat.
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking })
  depth.customProgramCacheKey = () => 'oblong-table-depth'
  depth.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${PARS}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${DISPLACE}`)
  }
  mesh.customDepthMaterial = depth

  mesh.userData.uniforms = uniforms
  mesh.userData.segments = [segX, segZ]
  return mesh
}

/**
 * A plane laid directly in XZ, built by hand so there is no ambiguity about
 * which way uv runs once the mesh is displaced.
 */
function buildFieldGeometry(segX, segZ) {
  const nx = segX + 1, nz = segZ + 1
  const pos = new Float32Array(nx * nz * 3)
  const nor = new Float32Array(nx * nz * 3)
  const uvs = new Float32Array(nx * nz * 2)
  let p = 0, n = 0, t = 0

  for (let j = 0; j < nz; j++) {
    const v = j / segZ
    for (let i = 0; i < nx; i++) {
      const u = i / segX
      pos[p++] = (u - 0.5) * FIELD_LEN
      pos[p++] = 0
      pos[p++] = (v - 0.5) * FIELD_DEP
      nor[n++] = 0; nor[n++] = 1; nor[n++] = 0
      uvs[t++] = u; uvs[t++] = v
    }
  }

  const idx = new Uint32Array(segX * segZ * 6)
  let k = 0
  for (let j = 0; j < segZ; j++) {
    for (let i = 0; i < segX; i++) {
      const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1
      idx[k++] = a; idx[k++] = c; idx[k++] = b
      idx[k++] = b; idx[k++] = c; idx[k++] = d
    }
  }

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  g.setIndex(new THREE.BufferAttribute(idx, 1))
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), FIELD_LEN)
  return g
}
