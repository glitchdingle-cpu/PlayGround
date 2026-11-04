import * as THREE from 'three'

export const WORLD = 440
export const HALF = WORLD / 2
export const SEGMENTS = 144
export const BASE_POSITIONS = [
  { x: -124, z: 120 },
  { x: 124, z: -120 },
]
export const CAPTURE_POSITIONS = [
  { x: 0, z: 0 },
  { x: -92, z: -44 },
  { x: 92, z: 50 },
]

// ── deterministic value noise ────────────────────────────────────────────────
function hash2(ix, iz, seed) {
  let h = ix * 374761393 + iz * 668265263 + seed * 2147483647
  h = (h ^ (h >>> 13)) * 1274126177
  h = h ^ (h >>> 16)
  return (h >>> 0) / 4294967295
}

function smooth(t) { return t * t * (3 - 2 * t) }

function valueNoise(x, z, seed = 1) {
  const ix = Math.floor(x), iz = Math.floor(z)
  const fx = smooth(x - ix), fz = smooth(z - iz)
  const a = hash2(ix, iz, seed), b = hash2(ix + 1, iz, seed)
  const c = hash2(ix, iz + 1, seed), d = hash2(ix + 1, iz + 1, seed)
  return (a * (1 - fx) + b * fx) * (1 - fz) + (c * (1 - fx) + d * fx) * fz
}

function fbm(x, z, seed = 1, octaves = 4) {
  let value = 0, amp = 0.5, freq = 1
  for (let i = 0; i < octaves; i++) {
    value += valueNoise(x * freq, z * freq, seed + i * 17) * amp
    freq *= 2.03
    amp *= 0.5
  }
  return value
}

function clamp(v, a, b) { return v < a ? a : v > b ? b : v }
function lerp(a, b, t) { return a + (b - a) * t }
function smoothstep(a, b, v) {
  const t = clamp((v - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

// ── map-specific base elevation ──────────────────────────────────────────────
function baseHeight(map, x, z) {
  const n1 = fbm(x * 0.012, z * 0.012, 11)
  const n2 = fbm(x * 0.035, z * 0.035, 29)
  const n3 = fbm(x * 0.006, z * 0.006, 71)
  switch (map.type) {
    case 'flanders':
      return (n1 - 0.5) * 4.2 + (n2 - 0.5) * 1.2 + Math.sin((x + z) * 0.021) * 0.7
    case 'verdun': {
      const ridge = Math.exp(-Math.pow((z + x * 0.22 + 20) / 54, 2)) * 8.5
      return (n3 - 0.5) * 13 + (n1 - 0.5) * 5.5 + ridge
    }
    case 'sinai':
      return Math.sin(x * 0.032 + n2 * 2.2) * 2.6 + Math.sin(z * 0.021 + n3 * 3) * 2.2 + (n1 - 0.5) * 4.5
    case 'normandy':
      return (n1 - 0.5) * 5.2 + Math.sin(x * 0.013) * 1.1 + (n2 - 0.5) * 0.8
    case 'stalingrad':
      return (n1 - 0.5) * 2.2 + (n2 - 0.5) * 0.9 + Math.max(0, Math.sin(x * 0.05) * Math.cos(z * 0.045)) * 0.7
    case 'pacific': {
      const r = Math.sqrt(Math.pow(x / 1.12, 2) + Math.pow(z / 0.9, 2))
      const land = smoothstep(218, 116, r)
      return -3.1 + land * 6.4 + (n2 - 0.5) * 1.1 * land + Math.sin(x * 0.045) * 0.35 * land
    }
    case 'fulda':
      return (n3 - 0.5) * 18 + (n1 - 0.5) * 6 + Math.sin((x - z) * 0.01) * 1.8
    case 'desertStorm':
      return (n1 - 0.5) * 4 + Math.sin(x * 0.028 + n2 * 2) * 1.8 + Math.sin(z * 0.023) * 1.2
    case 'seoul':
      return (n1 - 0.5) * 2.6 + (n2 - 0.5) * 0.7
    default:
      return (n1 - 0.5) * 4
  }
}

function seeded(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

const PROP_COLORS = {
  flanders: { trunk: 0x3e382a, leaf: 0x4c4a2c, rock: 0x5f5a48, wall: 0x6a644f, hedge: 0x50502f },
  verdun: { trunk: 0x403a2b, leaf: 0x4d4b2f, rock: 0x615c4b, wall: 0x706952, hedge: 0x56542f },
  sinai: { trunk: 0x6b5638, leaf: 0x7f7a42, rock: 0x9a8055, wall: 0x9c8352, hedge: 0x8a7c4a },
  normandy: { trunk: 0x4b3e2b, leaf: 0x3c5a2c, rock: 0x77745e, wall: 0x7b725c, hedge: 0x344a27 },
  stalingrad: { trunk: 0x48423a, leaf: 0x5b625d, rock: 0x7a7d7c, wall: 0x7d8081, hedge: 0x5c6260 },
  pacific: { trunk: 0x6a563b, leaf: 0x49753e, rock: 0x8b8468, wall: 0x978a68, hedge: 0x4d7142 },
  fulda: { trunk: 0x453a29, leaf: 0x38522d, rock: 0x6d705c, wall: 0x77725e, hedge: 0x334a2a },
  desertStorm: { trunk: 0x6e5b3e, leaf: 0x7c774a, rock: 0x9f8b61, wall: 0xa08b62, hedge: 0x877b50 },
  seoul: { trunk: 0x46453c, leaf: 0x4c5a4a, rock: 0x70726b, wall: 0x767971, hedge: 0x475647 },
}

function makeSkyMaterial(palette) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      topColor: { value: new THREE.Color(palette.sky).multiplyScalar(0.82) },
      bottomColor: { value: new THREE.Color(palette.fog) },
      sunColor: { value: new THREE.Color(palette.sun) },
      offset: { value: 30 },
      exponent: { value: 0.7 },
    },
    vertexShader: `varying vec3 vWorld; void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vWorld=wp.xyz; gl_Position=projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform vec3 topColor; uniform vec3 bottomColor; uniform vec3 sunColor; uniform float offset; uniform float exponent;
      varying vec3 vWorld;
      void main(){
        vec3 dir = normalize(vWorld + vec3(0.0, offset, 0.0));
        float h = clamp(dir.y, 0.0, 1.0);
        vec3 col = mix(bottomColor, topColor, pow(h, exponent));
        float sun = pow(max(dot(dir, normalize(vec3(-0.55, 0.62, -0.42))), 0.0), 90.0);
        col += sunColor * sun * 0.65;
        float haze = pow(max(1.0 - h, 0.0), 7.0);
        col = mix(col, bottomColor, haze * 0.5);
        gl_FragColor = vec4(col, 1.0);
      }`,
  })
}

export class Terrain {
  constructor(map, scene) {
    this.map = map
    this.scene = scene
    this.size = WORLD
    this.segments = SEGMENTS
    this.res = SEGMENTS + 1
    this.heights = new Float32Array(this.res * this.res)
    this.scorch = new Float32Array(this.res * this.res)
    this.palette = {
      low: new THREE.Color(map.palette.low),
      mid: new THREE.Color(map.palette.mid),
      high: new THREE.Color(map.palette.high),
      rock: new THREE.Color(map.palette.rock),
    }
    this.skyColor = new THREE.Color(map.palette.sky)
    this.fogColor = new THREE.Color(map.palette.fog)
    this.rng = seeded(map.id.split('').reduce((a, c) => a + c.charCodeAt(0), 71))
    this.group = new THREE.Group()
    this.group.name = 'terrain'
    scene.add(this.group)
    this.buildField()
    this.buildMesh()
    this.buildProps()
    this.buildWater()
    this.buildSky()
  }

  buildField() {
    const res = this.res
    const step = this.size / (res - 1)
    for (let iz = 0; iz < res; iz++) {
      for (let ix = 0; ix < res; ix++) {
        const x = -HALF + ix * step
        const z = -HALF + iz * step
        this.heights[iz * res + ix] = baseHeight(this.map, x, z)
      }
    }
    // level out the two base pads and the three capture points
    for (const base of BASE_POSITIONS) this.flattenField(base.x, base.z, 36, 1.2)
    for (const cap of CAPTURE_POSITIONS) this.flattenField(cap.x, cap.z, 13, 0.8)
    // atmospheric pre-battle shelling on the scarred maps
    const preCraters = this.map.type === 'flanders' ? 34 : this.map.type === 'verdun' ? 24 : this.map.type === 'stalingrad' ? 18 : this.map.type === 'normandy' ? 7 : this.map.type === 'seoul' ? 6 : 0
    for (let i = 0; i < preCraters; i++) {
      const x = (this.rng() - 0.5) * (this.size - 40)
      const z = (this.rng() - 0.5) * (this.size - 40)
      if (this.nearImportant(x, z, 26)) continue
      this.craterField(x, z, 3.5 + this.rng() * 6, 0.7 + this.rng() * 1.9, 0.55)
    }
  }

  flattenField(x, z, radius, strength) {
    const res = this.res
    const step = this.size / (res - 1)
    const ix0 = Math.max(0, Math.floor((x + HALF - radius) / step))
    const ix1 = Math.min(res - 1, Math.ceil((x + HALF + radius) / step))
    const iz0 = Math.max(0, Math.floor((z + HALF - radius) / step))
    const iz1 = Math.min(res - 1, Math.ceil((z + HALF + radius) / step))
    let sum = 0, n = 0
    for (let iz = iz0; iz <= iz1; iz++) for (let ix = ix0; ix <= ix1; ix++) {
      const wx = -HALF + ix * step, wz = -HALF + iz * step
      if (Math.hypot(wx - x, wz - z) < radius * 0.6) { sum += this.heights[iz * res + ix]; n++ }
    }
    const target = n ? sum / n : this.sample(x, z)
    for (let iz = iz0; iz <= iz1; iz++) for (let ix = ix0; ix <= ix1; ix++) {
      const wx = -HALF + ix * step, wz = -HALF + iz * step
      const d = Math.hypot(wx - x, wz - z)
      const t = smoothstep(radius * 0.55, radius, d)
      const idx = iz * res + ix
      this.heights[idx] = lerp(target * strength, this.heights[idx], t)
    }
  }

  craterField(x, z, radius, depth, scorchAmount) {
    const res = this.res
    const step = this.size / (res - 1)
    const ix0 = Math.max(0, Math.floor((x + HALF - radius * 1.35) / step))
    const ix1 = Math.min(res - 1, Math.ceil((x + HALF + radius * 1.35) / step))
    const iz0 = Math.max(0, Math.floor((z + HALF - radius * 1.35) / step))
    const iz1 = Math.min(res - 1, Math.ceil((z + HALF + radius * 1.35) / step))
    for (let iz = iz0; iz <= iz1; iz++) for (let ix = ix0; ix <= ix1; ix++) {
      const wx = -HALF + ix * step, wz = -HALF + iz * step
      const d = Math.hypot(wx - x, wz - z)
      const t = d / radius
      let delta = 0
      if (t < 1.22) {
        const bowl = -depth * Math.pow(Math.max(0, 1 - t * t), 1.45)
        const rim = depth * 0.3 * Math.exp(-Math.pow((t - 0.92) / 0.17, 2))
        delta = bowl + rim
      }
      const idx = iz * res + ix
      this.heights[idx] += delta
      if (t < 1.25) this.scorch[idx] = Math.min(1, this.scorch[idx] + scorchAmount * (1 - smoothstep(0.3, 1.2, t)))
    }
  }

  buildMesh() {
    const geo = new THREE.PlaneGeometry(this.size, this.size, this.segments, this.segments)
    geo.rotateX(-Math.PI / 2)
    const pos = geo.attributes.position
    const colors = new Float32Array(pos.count * 3)
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    this.geometry = geo
    this.colors = colors
    this.repaintField()
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.96,
      metalness: 0.02,
      flatShading: true,
    })
    this.mesh = new THREE.Mesh(geo, mat)
    this.mesh.receiveShadow = true
    this.mesh.name = 'ground'
    this.group.add(this.mesh)
    this.applyHeightsToGeometry(true)
  }

  repaintField() {
    const res = this.res
    const step = this.size / (res - 1)
    const c = new THREE.Color()
    const { low, mid, high, rock } = this.palette
    for (let iz = 0; iz < res; iz++) {
      for (let ix = 0; ix < res; ix++) {
        const idx = iz * res + ix
        const x = -HALF + ix * step, z = -HALF + iz * step
        const h = this.heights[idx]
        const hx = this.heights[iz * res + Math.min(res - 1, ix + 1)] - this.heights[iz * res + Math.max(0, ix - 1)]
        const hz = this.heights[Math.min(res - 1, iz + 1) * res + ix] - this.heights[Math.max(0, iz - 1) * res + ix]
        const slope = Math.hypot(hx, hz) / (step * 2)
        const normHeight = clamp((h + 8) / 26, 0, 1)
        if (normHeight < 0.45) c.copy(low).lerp(mid, normHeight / 0.45)
        else c.copy(mid).lerp(high, (normHeight - 0.45) / 0.55)
        c.lerp(rock, smoothstep(0.32, 0.85, slope) * 0.55)
        const noise = (hash2(ix, iz, 907) - 0.5) * 0.12
        c.offsetHSL(noise * 0.03, noise * 0.08, noise * 0.45)
        if (this.scorch[idx] > 0) {
          const s = this.scorch[idx]
          c.lerp(this.palette.rock.clone().multiplyScalar(0.32), Math.min(0.88, s * 0.9))
          c.offsetHSL(0.01, 0.06, -0.02 * s)
        }
        this.colors[idx * 3] = c.r
        this.colors[idx * 3 + 1] = c.g
        this.colors[idx * 3 + 2] = c.b
      }
    }
    if (this.geometry) {
      this.geometry.attributes.color.needsUpdate = true
      this.geometry.attributes.color.needsUpdate = true
    }
  }

  applyHeightsToGeometry(full = false) {
    const geo = this.geometry
    const pos = geo.attributes.position
    const res = this.res
    const step = this.size / (res - 1)
    for (let iz = 0; iz < res; iz++) for (let ix = 0; ix < res; ix++) {
      const idx = iz * res + ix
      pos.setY(idx, this.heights[idx])
      // plane geometry rotated: vertex ordering matches (ix, iz)
      if (full) { pos.setX(idx, -HALF + ix * step); pos.setZ(idx, -HALF + iz * step) }
    }
    pos.needsUpdate = true
    geo.computeVertexNormals()
    geo.computeBoundingSphere()
    if (this.colors) this.repaintColorsOnly()
  }

  repaintColorsOnly() {
    // only recolor scorched cells; called after deformation
    const res = this.res
    const step = this.size / (res - 1)
    const c = new THREE.Color()
    const { low, mid, high, rock } = this.palette
    for (let iz = 0; iz < res; iz++) for (let ix = 0; ix < res; ix++) {
      const idx = iz * res + ix
      if (this.scorch[idx] <= 0) continue
      const x = -HALF + ix * step, z = -HALF + iz * step
      const h = this.heights[idx]
      const normHeight = clamp((h + 8) / 26, 0, 1)
      if (normHeight < 0.45) c.copy(low).lerp(mid, normHeight / 0.45)
      else c.copy(mid).lerp(high, (normHeight - 0.45) / 0.55)
      c.lerp(rock, 0.2)
      c.lerp(rock.clone().multiplyScalar(0.3), Math.min(0.9, this.scorch[idx] * 0.92))
      this.colors[idx * 3] = c.r
      this.colors[idx * 3 + 1] = c.g
      this.colors[idx * 3 + 2] = c.b
    }
    this.geometry.attributes.color.needsUpdate = true
  }

  buildProps() {
    const rng = seeded(this.map.id.length * 991 + 7)
    const count = this.map.type === 'seoul' ? 120 : this.map.type === 'stalingrad' ? 95 : 150
    const placements = []
    for (let i = 0; i < count * 3 && placements.length < count; i++) {
      const x = (rng() - 0.5) * (this.size - 24)
      const z = (rng() - 0.5) * (this.size - 24)
      if (this.nearImportant(x, z, 30)) continue
      if (this.map.water && this.sample(x, z) < 0.5) continue
      const hx = this.sample(x + 2, z) - this.sample(x - 2, z)
      if (Math.abs(hx) > 2.2 && this.map.type !== 'verdun') continue
      placements.push({ x, z, y: this.sample(x, z), s: 0.75 + rng() * 0.9, r: rng() * Math.PI * 2 })
    }
    const colors = PROP_COLORS[this.map.type] || PROP_COLORS.fulda
    const type = this.map.props
    const dummy = new THREE.Object3D()

    const instanced = (geo, color, list, opts = {}) => {
      if (!list.length) return null
      const mat = new THREE.MeshStandardMaterial({
        color, roughness: 0.92, metalness: 0.02, flatShading: true,
        ...(opts.material || {}),
      })
      const mesh = new THREE.InstancedMesh(geo, mat, list.length)
      list.forEach((p, i) => {
        dummy.position.set(p.x, p.y + (opts.yOff || 0) * p.s, p.z)
        dummy.rotation.set(opts.rx ? p.r * 0.1 : 0, p.r + (opts.rot || 0), opts.rz ? p.r * 0.04 : 0)
        dummy.scale.set(p.s * (opts.sx || 1), p.s * (opts.sy || 1), p.s * (opts.sz || 1))
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
        if (mesh.setColorAt) mesh.setColorAt(i, new THREE.Color(color).offsetHSL(0, 0, (hash2(i, 3, 11) - 0.5) * 0.1))
      })
      mesh.castShadow = opts.shadow !== false
      mesh.receiveShadow = true
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      this.group.add(mesh)
      return mesh
    }

    const merge = (geos) => {
      // lightweight merge without importing BufferGeometryUtils: build a group instead
      const g = new THREE.Group()
      for (const { geo, color, pos, rot, scale } of geos) {
        const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.94, flatShading: true }))
        if (pos) m.position.set(...pos)
        if (rot) m.rotation.set(...rot)
        if (scale) m.scale.set(...scale)
        m.castShadow = true
        m.receiveShadow = true
        g.add(m)
      }
      return g
    }
    // Individual props are batched through InstancedMesh; composites use instanced primitives.
    const trunkList = [], leafList = [], rockList = [], wallList = [], hedgeList = [], frondList = [], rubbleList = []
    for (const p of placements) {
      if (type === 'deadTrees') {
        if (p.s > 1.12) trunkList.push(p)
        else rockList.push(p)
      } else if (type === 'hedges') {
        if (hash2(Math.floor(p.x), Math.floor(p.z), 5) > 0.55) hedgeList.push(p)
        else trunkList.push(p)
        if (hash2(Math.floor(p.x), Math.floor(p.z), 8) > 0.72) leafList.push(p)
      } else if (type === 'urbanSnow' || type === 'city') {
        if (hash2(Math.floor(p.x), Math.floor(p.z), 5) > 0.48) wallList.push(p)
        else rubbleList.push(p)
      } else if (type === 'palms') {
        if (Math.abs(p.x) < 150 && Math.abs(p.z) < 150) { trunkList.push(p); frondList.push(p) }
        else rockList.push(p)
      } else if (type === 'desert' || type === 'desertWar') {
        if (hash2(Math.floor(p.x), Math.floor(p.z), 5) > 0.72) rockList.push(p)
        else if (type === 'desertWar' && hash2(Math.floor(p.x), Math.floor(p.z), 9) > 0.6) wallList.push(p)
        else if (p.s > 1.25) leafList.push(p)
      } else {
        if (p.s > 1.2) rockList.push(p)
        else { trunkList.push(p); leafList.push(p) }
      }
    }
    const trunkGeo = new THREE.CylinderGeometry(0.28, 0.42, 2.8, 5)
    const leafGeo = new THREE.ConeGeometry(1.5, 4.2, 6)
    const roundLeaf = new THREE.IcosahedronGeometry(1.55, 0)
    const rockGeo = new THREE.DodecahedronGeometry(1.1, 0)
    const wallGeo = new THREE.BoxGeometry(2.4, 3.6, 0.55)
    const hedgeGeo = new THREE.BoxGeometry(6.4, 1.35, 1.5)
    const frondGeo = new THREE.ConeGeometry(1.8, 2.3, 5, 1, true)
    const rubbleGeo = new THREE.BoxGeometry(1.6, 0.55, 1.2)

    // Offset trunks so they sit in the ground
    trunkList.forEach(p => { p.y -= 0.2 })
    instanced(trunkGeo, colors.trunk, trunkList, { yOff: 1.4, sy: 1.15, sx: 1, sz: 1 })
    const usePalm = type === 'palms'
    if (usePalm) instanced(frondGeo, colors.leaf, frondList, { yOff: 3.7, sy: 0.5, sx: 1, sz: 1 })
    else {
      instanced(usePalm ? roundLeaf : leafGeo, colors.leaf, leafList, { yOff: 3.5, sy: 1.1 })
      if (this.map.type === 'normandy') instanced(roundLeaf, colors.leaf, leafList, { yOff: 2.8, sy: 0.8 })
    }
    instanced(rockGeo, colors.rock, rockList, { yOff: 0.35, sy: 0.7, sx: 1.1, sz: 0.9 })
    instanced(wallGeo, colors.wall, wallList, { yOff: 1.7, sy: 1, rz: false, rx: true, shadow: true })
    instanced(hedgeGeo, colors.hedge, hedgeList, { yOff: 0.55, sy: 1, rot: 0.2 })
    instanced(rubbleGeo, colors.wall, rubbleList, { yOff: 0.2, sy: 1, rx: true })
  }

  buildWater() {
    if (!this.map.water) return
    const geo = new THREE.PlaneGeometry(1400, 1400, 1, 1)
    const mat = new THREE.MeshStandardMaterial({ color: 0x3b8791, transparent: true, opacity: 0.82, roughness: 0.18, metalness: 0.25 })
    this.water = new THREE.Mesh(geo, mat)
    this.water.rotation.x = -Math.PI / 2
    this.water.position.y = -1.35
    this.water.receiveShadow = true
    this.group.add(this.water)
  }

  buildSky() {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(900, 24, 16), makeSkyMaterial(this.map.palette))
    dome.frustumCulled = false
    this.scene.add(dome)
    this.sky = dome
    this.scene.fog = new THREE.Fog(this.map.palette.fog, 170, 520)
  }

  sample(x, z) {
    const res = this.res
    const step = this.size / (res - 1)
    const fx = clamp((x + HALF) / step, 0, res - 1.001)
    const fz = clamp((z + HALF) / step, 0, res - 1.001)
    const ix = Math.floor(fx), iz = Math.floor(fz)
    const tx = fx - ix, tz = fz - iz
    const h00 = this.heights[iz * res + ix]
    const h10 = this.heights[iz * res + ix + 1]
    const h01 = this.heights[(iz + 1) * res + ix]
    const h11 = this.heights[(iz + 1) * res + ix + 1]
    return lerp(lerp(h00, h10, tx), lerp(h01, h11, tx), tz)
  }

  normalAt(x, z) {
    const e = 1.5
    const hL = this.sample(x - e, z), hR = this.sample(x + e, z)
    const hD = this.sample(x, z - e), hU = this.sample(x, z + e)
    return new THREE.Vector3(hL - hR, 2 * e, hD - hU).normalize()
  }

  nearImportant(x, z, pad = 24) {
    for (const b of BASE_POSITIONS) if (Math.hypot(x - b.x, z - b.z) < pad + 16) return true
    for (const c of CAPTURE_POSITIONS) if (Math.hypot(x - c.x, z - c.z) < pad * 0.7) return true
    return false
  }

  canBuild(x, z, size) {
    if (Math.abs(x) > HALF - 12 || Math.abs(z) > HALF - 12) return false
    if (this.map.water && this.sample(x, z) < 0.6) return false
    let min = Infinity, max = -Infinity
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]) {
      const h = this.sample(x + dx * size * 0.7, z + dz * size * 0.7)
      min = Math.min(min, h); max = Math.max(max, h)
      if (this.map.water && h < 0.3) return false
    }
    return max - min < 2.4
  }

  deform(x, z, radius, depth, scorch = 0.8) {
    this.craterField(x, z, radius, depth, scorch)
    this.applyHeightsToGeometry()
    // soften any nearby unit y via callback
    if (this.onDeform) this.onDeform(x, z, radius)
  }

  update(dt, time) {
    if (this.water) {
      this.water.position.y = -1.35 + Math.sin(time * 0.6) * 0.06
      this.water.material.opacity = 0.8 + Math.sin(time * 0.9) * 0.025
    }
    if (this.sky) this.sky.position.set(0, 0, 0)
  }

  dispose() {
    this.group.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose()
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose())
        else obj.material.dispose()
      }
    })
    if (this.sky) {
      this.sky.geometry.dispose()
      this.sky.material.dispose()
      this.sky.parent?.remove(this.sky)
    }
    this.scene.remove(this.group)
  }
}

export { seeded, smoothstep, clamp, lerp }
