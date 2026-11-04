import * as THREE from 'three'
import { clamp } from './util.js'

const VERT = `
  attribute float size;
  attribute float alpha;
  attribute vec3 color;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vColor = color;
    vAlpha = alpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (520.0 / max(0.1, -mv.z));
    gl_Position = projectionMatrix * mv;
  }
`
const FRAG = `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 q = gl_PointCoord - vec2(0.5);
    float d = length(q);
    if (d > 0.5) discard;
    float soft = smoothstep(0.5, 0.06, d);
    gl_FragColor = vec4(vColor, vAlpha * soft);
  }
`

export class Particles {
  constructor(scene, max = 1600, additive = false) {
    this.max = max
    this.list = []
    this.positions = new Float32Array(max * 3)
    this.colors = new Float32Array(max * 3)
    this.sizes = new Float32Array(max)
    this.alphas = new Float32Array(max)
    this.geo = new THREE.BufferGeometry()
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage))
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage))
    this.geo.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1).setUsage(THREE.DynamicDrawUsage))
    this.geo.setAttribute('alpha', new THREE.BufferAttribute(this.alphas, 1).setUsage(THREE.DynamicDrawUsage))
    this.geo.setDrawRange(0, 0)
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    })
    this.points = new THREE.Points(this.geo, this.material)
    this.points.frustumCulled = false
    this.points.renderOrder = additive ? 5 : 4
    scene.add(this.points)
  }

  add(p) {
    if (this.list.length >= this.max) this.list.shift()
    this.list.push(p)
  }

  burst(origin, opts = {}) {
    const {
      count = 10, color = 0xffb061, speed = 7, spread = 1, up = 3, gravity = -12,
      life = 0.7, size = 0.7, sizeVar = 0.5, alpha = 1, drag = 0.92, direction = null,
    } = opts
    const c = new THREE.Color(color)
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.random() * Math.PI
      const s = speed * (0.25 + Math.random() * 0.75)
      let vx = Math.sin(phi) * Math.cos(theta) * s * spread
      let vy = Math.abs(Math.cos(phi)) * s + up * (0.4 + Math.random() * 0.8)
      let vz = Math.sin(phi) * Math.sin(theta) * s * spread
      if (direction) {
        vx = direction.x * s + (Math.random() - 0.5) * spread * 2
        vy = direction.y * s + (Math.random() - 0.5) * spread * 2
        vz = direction.z * s + (Math.random() - 0.5) * spread * 2
      }
      const tint = 0.75 + Math.random() * 0.5
      this.add({
        x: origin.x, y: origin.y, z: origin.z,
        vx, vy, vz, gravity, drag,
        life: life * (0.6 + Math.random() * 0.8), maxLife: life,
        size: size * (1 - sizeVar / 2 + Math.random() * sizeVar),
        r: c.r * tint, g: c.g * tint, b: c.b * tint,
        alpha, fade: true,
      })
    }
  }

  smoke(origin, opts = {}) {
    const {
      count = 6, color = 0x4a4a42, speed = 1.2, life = 2.6, size = 2.4,
      rise = 2.2, spread = 1.2, alpha = 0.42, drift = 0.6,
    } = opts
    const c = new THREE.Color(color)
    for (let i = 0; i < count; i++) {
      this.add({
        x: origin.x + (Math.random() - 0.5) * spread,
        y: origin.y + Math.random() * 1.2,
        z: origin.z + (Math.random() - 0.5) * spread,
        vx: (Math.random() - 0.5) * speed + drift,
        vy: rise * (0.5 + Math.random()),
        vz: (Math.random() - 0.5) * speed,
        gravity: 0.15, drag: 0.985,
        life: life * (0.65 + Math.random() * 0.6), maxLife: life,
        size: size * (0.7 + Math.random() * 0.7),
        r: c.r, g: c.g, b: c.b,
        alpha, fade: true, grow: 1.7,
      })
    }
  }

  update(dt) {
    const list = this.list
    let n = 0
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i]
      p.life -= dt
      if (p.life <= 0) { list.splice(i, 1); continue }
      p.vy += p.gravity * dt
      const drag = Math.pow(p.drag, dt * 60)
      p.vx *= drag; p.vz *= drag
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.z += p.vz * dt
      if (p.y < -2) { p.life = 0; continue }
      const t = clamp(p.life / p.maxLife, 0, 1)
      if (p.grow) p.size += p.grow * dt
      const idx = n
      this.positions[idx * 3] = p.x
      this.positions[idx * 3 + 1] = p.y
      this.positions[idx * 3 + 2] = p.z
      this.colors[idx * 3] = p.r
      this.colors[idx * 3 + 1] = p.g
      this.colors[idx * 3 + 2] = p.b
      this.sizes[idx] = p.size
      this.alphas[idx] = p.alpha * (p.fade ? Math.min(1, t * 1.8) : 1)
      n++
    }
    this.geo.setDrawRange(0, n)
    this.geo.attributes.position.needsUpdate = true
    this.geo.attributes.color.needsUpdate = true
    this.geo.attributes.size.needsUpdate = true
    this.geo.attributes.alpha.needsUpdate = true
  }

  dispose() {
    this.points.parent?.remove(this.points)
    this.geo.dispose()
    this.material.dispose()
    this.list.length = 0
  }
}

let pointTexture = null
function getPointTexture() {
  if (pointTexture) return pointTexture
  const c = document.createElement('canvas')
  c.width = 32; c.height = 32
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16)
  g.addColorStop(0, 'rgba(255,255,255,0.95)')
  g.addColorStop(0.4, 'rgba(255,255,255,0.5)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 32, 32)
  pointTexture = new THREE.CanvasTexture(c)
  pointTexture.colorSpace = THREE.SRGBColorSpace
  return pointTexture
}

export class Weather {
  constructor(scene, map) {
    this.type = map.weather || 'clear'
    if (this.type === 'clear') { this.disabled = true; return }
    const count = this.type === 'rain' ? 1300 : this.type === 'snow' ? 900 : 700
    this.count = count
    this.positions = new Float32Array(count * 3)
    this.speeds = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      this.positions[i * 3] = (Math.random() - 0.5) * 180
      this.positions[i * 3 + 1] = Math.random() * 55
      this.positions[i * 3 + 2] = (Math.random() - 0.5) * 180
      this.speeds[i] = 0.5 + Math.random()
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage))
    const color = this.type === 'snow' ? 0xf0f5f7 : this.type === 'dust' ? 0xd6bd8e : 0xb7c7c7
    const size = this.type === 'snow' ? 0.48 : this.type === 'dust' ? 0.34 : 0.16
    this.material = new THREE.PointsMaterial({
      color, size, map: getPointTexture(), transparent: true, depthWrite: false,
      opacity: this.type === 'snow' ? 0.9 : this.type === 'dust' ? 0.32 : 0.48,
      alphaTest: 0.05, blending: THREE.NormalBlending,
    })
    this.points = new THREE.Points(geo, this.material)
    this.points.frustumCulled = false
    this.geo = geo
    scene.add(this.points)
    this.center = new THREE.Vector3()
    this.seed = Math.random() * 100
  }

  update(dt, target, camera) {
    if (this.disabled) return
    this.center.copy(target)
    const arr = this.positions
    const c = this.center
    const cx = camera.position.x, cz = camera.position.z
    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3
      if (this.type === 'rain') {
        arr[i3 + 1] -= (34 + this.speeds[i] * 22) * dt
        arr[i3] += 8 * dt
        arr[i3 + 2] += 2 * dt
      } else if (this.type === 'snow') {
        arr[i3 + 1] -= (1.8 + this.speeds[i] * 1.6) * dt
        arr[i3] += Math.sin(this.seed + arr[i3 + 1] * 0.2 + i) * 0.35 * dt
        arr[i3 + 2] += Math.cos(this.seed + arr[i3 + 1] * 0.16 + i) * 0.3 * dt
      } else {
        arr[i3 + 1] += Math.sin(this.seed + i + arr[i3] * 0.05) * 0.28 * dt
        arr[i3] += (2.5 + this.speeds[i]) * dt
        arr[i3 + 2] += Math.sin(this.seed + i * 0.7) * 0.3 * dt
      }
      // wrap relative to the camera focus so density stays constant
      const relX = arr[i3] - c.x
      const relZ = arr[i3 + 2] - c.z
      if (relX > 95) arr[i3] -= 190
      else if (relX < -95) arr[i3] += 190
      if (relZ > 95) arr[i3 + 2] -= 190
      else if (relZ < -95) arr[i3 + 2] += 190
      if (arr[i3 + 1] < -2) {
        arr[i3] = c.x + (Math.random() - 0.5) * 170
        arr[i3 + 1] = 45 + Math.random() * 20
        arr[i3 + 2] = c.z + (Math.random() - 0.5) * 170
      }
      if (arr[i3 + 1] > 60) arr[i3 + 1] = 2
      if (Math.abs(arr[i3] - cx) > 150) arr[i3] = cx + (Math.random() - 0.5) * 160
      if (Math.abs(arr[i3 + 2] - cz) > 150) arr[i3 + 2] = cz + (Math.random() - 0.5) * 160
    }
    this.geo.attributes.position.needsUpdate = true
  }

  dispose() {
    if (this.disabled) return
    this.points.parent?.remove(this.points)
    this.geo.dispose()
    this.material.dispose()
  }
}
