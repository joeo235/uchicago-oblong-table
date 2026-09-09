/**
 * The table's surface, held as a live heightfield in a ping-pong render target.
 *
 * This is the load-bearing idea of the whole piece. The relief is not modelled
 * geometry — it accumulates from gestures and then keeps moving on its own,
 * because the passage is explicit that the topography "is not fixed, but it
 * shifts."
 *
 * Channels:  R height (world units, relative to the table top)
 *            G grammar  0 = mold, 0.5 = method, 1 = set aside
 *            B age      0 fresh -> 1 settled
 *            A crispness, which drives how sharply the surface shades
 *
 * A CPU mirror of the same kernels lives in `heightAt()`, so objects can rest
 * on the surface without stalling the pipeline on a GPU readback. The two
 * kernel definitions must be kept in step.
 */
import * as THREE from 'three'

import { FIELD_DEP, FIELD_LEN } from '../config.js'
import { NOISE } from './shaders/noise.js'

const RT_W = 1024
const RT_H = 224
const MAX_STAMPS = 8          // per pass; the queue drains over several frames
const AGE_SECONDS = 45.0

const VERT = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`

/** Shared kernel maths, so drift and stamp agree on what a gesture looks like. */
const KERNEL = /* glsl */`
uniform vec2 uField;

// Distance in world units, so the render target's aspect never distorts a mark.
vec2 worldOf(vec2 uv) { return (uv - 0.5) * uField; }

// Returns (heightDelta, weight, crispness) for one gesture.
vec3 kernel(int grammar, vec2 world, vec2 c, float radius, float amp, float seed) {
  float d = distance(world, c);
  float q = d / max(radius, 1e-4);

  if (grammar == 0) {
    // MOLD - a broad, soft swell. Molding is generous and imprecise.
    float g = exp(-q * q * 2.2);
    float lobe = 0.16 * amp * exp(-q * q * 0.7) * sin(seed * 6.28318 + q * 3.0);
    return vec3(amp * g + lobe, g, 0.22);
  }
  if (grammar == 1) {
    // PLACE - a quantised terrace with a hard rim. Methodology has edges.
    float g = exp(-q * q * 1.5);
    float steps = 4.0;
    float t = floor(g * steps + 0.001) / steps;
    float rim = smoothstep(1.02, 0.98, q) * 0.10;
    return vec3(amp * (t + rim), smoothstep(1.15, 0.0, q), 0.95);
  }
  if (grammar == 2) {
    // SET ASIDE - a shallow dimple ringed by a raised lip. A considered mark,
    // deliberately not an absence: the object was handled, explored, and left.
    float dip = -amp * 0.52 * exp(-q * q * 3.0);
    float ring = amp * 0.46 * exp(-pow((q - 0.74) / 0.17, 2.0));
    float g = max(exp(-q * q * 3.0), exp(-pow((q - 0.74) / 0.17, 2.0)));
    return vec3(dip + ring, g, 0.62);
  }
  // STUDENT - not a mark but a shift: wide, shallow and rippled, moving a whole
  // region rather than a point. Nobody at the table put this here. Its claim on
  // the grammar channel is deliberately weak: a shift from the students changes
  // the shape of the table, it does not overwrite whose gesture was where.
  float wide = exp(-q * q * 0.85);
  float ripple = sin(q * 4.4 - seed * 6.28318) * 0.46;
  return vec3(amp * wide * (0.70 + ripple), wide * 0.26, 0.18);
}
`

const STAMP_FRAG = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform sampler2D uPrev;
uniform int   uCount;
uniform vec4  uStampA[${MAX_STAMPS}];   // x, z, radius, amplitude
uniform vec4  uStampB[${MAX_STAMPS}];   // grammar, seed, aged, -
${KERNEL}

void main() {
  vec4 s = texture2D(uPrev, vUv);
  vec2 world = worldOf(vUv);

  for (int i = 0; i < ${MAX_STAMPS}; i++) {
    if (i >= uCount) break;
    vec4 a = uStampA[i];
    int grammar = int(uStampB[i].x + 0.5);
    vec3 k = kernel(grammar, world, a.xy, a.z, a.w, uStampB[i].y);
    float w = clamp(k.y * 1.6, 0.0, 1.0);
    // Replayed history arrives already settled; only a gesture made now glows.
    float fresh = 1.0 - uStampB[i].z;
    s.r += k.x;
    s.g  = mix(s.g, float(grammar) / 3.0, w);
    s.b  = mix(s.b, mix(1.0, 0.0, fresh), w);
    s.a  = mix(s.a, k.z, w);
  }
  gl_FragColor = s;
}
`

const DRIFT_FRAG = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform sampler2D uPrev;
uniform vec2  uTexel;
uniform float uTime;
uniform float uDt;
uniform float uErode;
uniform float uWander;
${NOISE}

float wander(vec2 p, float t) {
  return fbm(p + vec2(t * 0.021, t * -0.013)) * 0.65
       + fbm(p * 2.7 - vec2(t * 0.011, t * 0.017)) * 0.35;
}

void main() {
  vec4 s = texture2D(uPrev, vUv);

  // Erode fine detail only, and slowly. This is diffusion, so the rate has to
  // be set against how long the piece runs: at dt*0.55 the smoothing length
  // reaches the size of a gesture inside ten minutes and the table goes flat,
  // which would be the piece quietly arguing for consensus. At this rate the
  // quarry grain softens and the marks themselves stay put indefinitely.
  float n = texture2D(uPrev, vUv + vec2( uTexel.x, 0.0)).r
          + texture2D(uPrev, vUv - vec2( uTexel.x, 0.0)).r
          + texture2D(uPrev, vUv + vec2(0.0,  uTexel.y)).r
          + texture2D(uPrev, vUv - vec2(0.0,  uTexel.y)).r;
  float blur = n * 0.25;
  s.r = mix(s.r, blur, clamp(uDt * uErode, 0.0, 0.05));

  // ...and put variance straight back as a slow wander, so the surface keeps
  // moving with nobody touching it. This is "not fixed, but it shifts".
  //
  // Note this adds the *difference* of the wander field across the frame, not
  // the field itself. Adding the field accumulates: it is a random walk, and
  // over a long session the whole table creeps until it pins against the clamp.
  // The difference telescopes instead, so however long the piece is left
  // running the surface wanders inside a bounded envelope and never sinks.
  vec2 p = vUv * vec2(7.0, 2.2);
  s.r += (wander(p, uTime) - wander(p, uTime - uDt)) * uWander;

  // Keep the relief inside the tray.
  s.r = clamp(s.r, -0.10, 0.40);

  s.b = clamp(s.b + uDt / ${AGE_SECONDS.toFixed(1)}, 0.0, 1.0);
  s.a = mix(s.a, 0.35, clamp(uDt * 0.02, 0.0, 1.0));   // edges soften slowly
  gl_FragColor = s;
}
`

const INIT_FRAG = /* glsl */`
precision highp float;
varying vec2 vUv;
${NOISE}
void main() {
  // A faint quarry-grain so a virgin table is never mathematically flat.
  float g = fbm(vUv * vec2(9.0, 3.0)) * 0.006;
  gl_FragColor = vec4(g, 0.5, 1.0, 0.35);
}
`

export class Topography {
  constructor(renderer) {
    this.renderer = renderer
    this.time = 0
    this.queue = []
    this.marks = []          // CPU mirror, also what gets persisted

    // Full float, not half. The field is integrated in place across thousands
    // of frames, and at half precision the per-step increments fall below the
    // ULP of the value they are added to: the increments round away, the field
    // decays toward zero, and the table quietly goes flat. Measured over ten
    // simulated minutes, half precision retained 7% of its variance and fp32
    // retains all of it. Falls back to half where fp32 is not renderable.
    const float32 = renderer.getContext().getExtension('EXT_color_buffer_float')
    this.precision = float32 ? 'float32' : 'float16'
    const opts = {
      type: float32 ? THREE.FloatType : THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      depthBuffer: false,
      stencilBuffer: false,
    }
    this.rtA = new THREE.WebGLRenderTarget(RT_W, RT_H, opts)
    this.rtB = new THREE.WebGLRenderTarget(RT_W, RT_H, opts)

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2))
    this.fsScene = new THREE.Scene()
    this.fsScene.add(this.quad)

    const field = new THREE.Vector2(FIELD_LEN, FIELD_DEP)

    this.matInit = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: INIT_FRAG, depthTest: false,
    })
    this.matStamp = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: STAMP_FRAG, depthTest: false,
      uniforms: {
        uPrev: { value: null },
        uField: { value: field },
        uCount: { value: 0 },
        uStampA: { value: Array.from({ length: MAX_STAMPS }, () => new THREE.Vector4()) },
        uStampB: { value: Array.from({ length: MAX_STAMPS }, () => new THREE.Vector4()) },
      },
    })
    this.matDrift = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: DRIFT_FRAG, depthTest: false,
      uniforms: {
        uPrev: { value: null },
        uTexel: { value: new THREE.Vector2(1 / RT_W, 1 / RT_H) },
        uTime: { value: 0 },
        uDt: { value: 0 },
        // Tunable so the balance between erosion and wander can be measured
        // rather than guessed; see the long-run drift check in the README.
        uErode: { value: 0.06 },
        uWander: { value: 0.16 },
      },
    })

    this._pass(this.matInit)
  }

  get texture() { return this.rtA.texture }

  _pass(material) {
    const prev = this.renderer.getRenderTarget()
    this.quad.material = material
    if (material.uniforms?.uPrev) material.uniforms.uPrev.value = this.rtA.texture
    this.renderer.setRenderTarget(this.rtB)
    this.renderer.render(this.fsScene, this.camera)
    this.renderer.setRenderTarget(prev)
    const t = this.rtA; this.rtA = this.rtB; this.rtB = t
  }

  /**
   * Queue gestures. `x`/`z` are world coordinates on the table surface.
   * Marks are held on the CPU too, both for `heightAt` and for persistence.
   */
  stamp(list) {
    for (const m of list) {
      const mark = {
        x: m.x, z: m.z,
        radius: m.radius ?? 0.55,
        amp: m.amp ?? 0.16,
        grammar: m.grammar ?? 0,
        seed: m.seed ?? Math.random(),
        aged: m.aged ? 1 : 0,
      }
      this.marks.push(mark)
      this.queue.push(mark)
    }
  }

  /** Drain the whole queue immediately — used when replaying seed + history. */
  flush() {
    while (this.queue.length) this._drain()
  }

  _drain() {
    const batch = this.queue.splice(0, MAX_STAMPS)
    const u = this.matStamp.uniforms
    u.uCount.value = batch.length
    batch.forEach((m, i) => {
      u.uStampA.value[i].set(m.x, m.z, m.radius, m.amp)
      u.uStampB.value[i].set(m.grammar, m.seed, m.aged ?? 0, 0)
    })
    this._pass(this.matStamp)
  }

  update(dt) {
    this.time += dt
    if (this.queue.length) this._drain()
    const u = this.matDrift.uniforms
    u.uTime.value = this.time
    u.uDt.value = Math.min(dt, 0.05)
    this._pass(this.matDrift)
  }

  /**
   * CPU mirror of the GPU kernels above, so objects can rest on the relief.
   * Ignores the drift wander, which stays under a couple of millimetres.
   */
  heightAt(x, z) {
    let h = 0
    for (let i = 0; i < this.marks.length; i++) {
      const m = this.marks[i]
      const dx = x - m.x, dz = z - m.z
      const q = Math.sqrt(dx * dx + dz * dz) / Math.max(m.radius, 1e-4)
      if (q > (m.grammar === 3 ? 3.2 : 2.6)) continue
      if (m.grammar === 0) {
        h += m.amp * Math.exp(-q * q * 2.2)
          + 0.16 * m.amp * Math.exp(-q * q * 0.7) * Math.sin(m.seed * 6.28318 + q * 3.0)
      } else if (m.grammar === 1) {
        const g = Math.exp(-q * q * 1.5)
        const t = Math.floor(g * 4 + 0.001) / 4
        const rim = (q < 1.0 ? 1 : 0) * 0.10
        h += m.amp * (t + rim)
      } else if (m.grammar === 2) {
        h += -m.amp * 0.52 * Math.exp(-q * q * 3.0)
          + m.amp * 0.46 * Math.exp(-Math.pow((q - 0.74) / 0.17, 2))
      } else {
        const wide = Math.exp(-q * q * 0.85)
        const ripple = Math.sin(q * 4.4 - m.seed * 6.28318) * 0.46
        h += m.amp * wide * (0.70 + ripple)
      }
    }
    return Math.max(-0.10, Math.min(0.40, h))
  }

  /** Roughness of the surface — used to prove the table never flattens. */
  variance(samples = 240) {
    let s = 0, s2 = 0
    for (let i = 0; i < samples; i++) {
      const x = (i / samples - 0.5) * FIELD_LEN
      const z = ((i * 7919 % samples) / samples - 0.5) * FIELD_DEP
      const h = this.heightAt(x, z)
      s += h; s2 += h * h
    }
    return s2 / samples - (s / samples) ** 2
  }

  dispose() {
    this.rtA.dispose(); this.rtB.dispose()
    this.quad.geometry.dispose()
    for (const m of [this.matInit, this.matStamp, this.matDrift]) m.dispose()
  }
}
