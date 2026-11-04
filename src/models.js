import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const UNIT_MATERIAL = new THREE.MeshStandardMaterial({
  vertexColors: true,
  flatShading: true,
  roughness: 0.82,
  metalness: 0.12,
})
const WRECK_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0x24231f,
  flatShading: true,
  roughness: 0.98,
  metalness: 0.05,
})
const SHADOW_MATERIAL = new THREE.MeshBasicMaterial({ color: 0x121208, transparent: true, opacity: 0.22, depthWrite: false })
const GLOW_MATERIAL = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide })

const C = {
  skin: 0xb98f68, skinDark: 0x8f6a4b, dark: 0x24241f, rubber: 0x1a1a18, metal: 0x4a4d46,
  metalDark: 0x30332e, glass: 0x36494b, track: 0x24251f, white: 0xd6d1bd, red: 0x8a2f2b,
  wood: 0x6b5437, sandbag: 0x877a56, concrete: 0x77796f, snow: 0xd7dcdb,
}

const flagCache = new Map()
function flagTexture(faction) {
  if (flagCache.has(faction.id)) return flagCache.get(faction.id)
  const canvas = document.createElement('canvas')
  canvas.width = 192
  canvas.height = 120
  const ctx = canvas.getContext('2d')
  const primary = '#' + new THREE.Color(faction.colors.primary).getHexString()
  const accent = '#' + new THREE.Color(faction.colors.accent).getHexString()
  const dark = '#' + new THREE.Color(faction.colors.secondary).getHexString()
  ctx.fillStyle = primary
  ctx.fillRect(0, 0, 192, 120)
  ctx.fillStyle = accent
  ctx.fillRect(0, 0, 192, 16)
  ctx.fillRect(0, 104, 192, 16)
  ctx.globalAlpha = 0.85
  ctx.fillStyle = dark
  ctx.beginPath()
  ctx.moveTo(0, 120)
  ctx.lineTo(96, 36)
  ctx.lineTo(192, 120)
  ctx.closePath()
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.fillStyle = accent
  ctx.font = 'bold 44px "Arial Narrow", Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(faction.monogram, 96, 70)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  flagCache.set(faction.id, tex)
  return tex
}

function paint(geo, color) {
  const c = new THREE.Color(color)
  const count = geo.attributes.position.count
  const arr = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    arr[i * 3] = c.r
    arr[i * 3 + 1] = c.g
    arr[i * 3 + 2] = c.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3))
  if (geo.attributes.uv) geo.deleteAttribute('uv')
  return geo
}

function part(list, geo, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone()
  g.scale(sx, sy, sz)
  if (rx) g.rotateX(rx)
  if (ry) g.rotateY(ry)
  if (rz) g.rotateZ(rz)
  g.translate(x, y, z)
  paint(g, color)
  list.push(g)
  return g
}

function merge(parts) {
  const filtered = parts.filter(Boolean)
  const geo = mergeGeometries(filtered, false)
  filtered.forEach(g => g.dispose())
  return geo
}

function mesh(parts, material = UNIT_MATERIAL) {
  const m = new THREE.Mesh(merge(parts), material)
  m.castShadow = true
  m.receiveShadow = true
  return m
}

function box(w, h, d) { return new THREE.BoxGeometry(w, h, d) }
function cyl(r1, r2, h, seg = 8) { return new THREE.CylinderGeometry(r1, r2, h, seg) }
function sphere(r, seg = 8) { return new THREE.SphereGeometry(r, seg, Math.max(4, seg / 2)) }
function cone(r, h, seg = 6) { return new THREE.ConeGeometry(r, h, seg) }

function makeWingGeometry(span, rootChord, tipChord, sweep, thickness) {
  const shape = new THREE.Shape()
  shape.moveTo(-span, rootChord / 2)
  shape.lineTo(-span, -rootChord / 2 - sweep)
  shape.lineTo(span, -tipChord / 2 - sweep)
  shape.lineTo(span, tipChord / 2 - sweep)
  shape.lineTo(span * 0.55, rootChord / 2)
  shape.lineTo(-span * 0.55, rootChord / 2)
  shape.lineTo(-span, rootChord / 2)
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false })
  geo.rotateX(Math.PI / 2)
  geo.translate(0, 0, 0)
  return geo
}

function addFlag(group, faction, x, y, z, scale = 1) {
  const poleParts = []
  part(poleParts, cyl(0.045, 0.06, 3.2, 5), C.metalDark, 0, 0, 0)
  const pole = mesh(poleParts)
  pole.position.set(x, y + 1.6, z)
  group.add(pole)
  const mat = new THREE.MeshStandardMaterial({ map: flagTexture(faction), side: THREE.DoubleSide, roughness: 0.95, metalness: 0 })
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.1 * scale, 1.3 * scale, 5, 1), mat)
  flag.position.set(x + 1.06 * scale, y + 2.75, z + 0.02)
  flag.castShadow = true
  flag.userData.isFlag = true
  group.add(flag)
  return flag
}

function eraColors(unit) {
  const f = unit.faction.colors
  const p = f.primary
  const s = f.secondary
  const a = f.accent
  if (unit.era === 'modern') {
    return { body: new THREE.Color(p).multiplyScalar(0.62).getHex(), body2: new THREE.Color(s).multiplyScalar(0.7).getHex(), accent: a, metal: C.metalDark, camo: new THREE.Color(p).multiplyScalar(0.9).getHex() }
  }
  if (unit.era === 'ww1') {
    return { body: p, body2: new THREE.Color(s).multiplyScalar(0.9).getHex(), accent: a, metal: C.metal, camo: new THREE.Color(s).multiplyScalar(0.85).getHex() }
  }
  return { body: p, body2: s, accent: a, metal: C.metal, camo: new THREE.Color(s).multiplyScalar(0.9).getHex() }
}

// ── infantry ────────────────────────────────────────────────────────────────
function soldierModel(unit) {
  const col = eraColors(unit)
  const g = new THREE.Group()
  const body = []
  const h = 1
  const modern = unit.era === 'modern'
  const accent = col.accent
  const helmetColor = modern ? new THREE.Color(col.body).multiplyScalar(0.75).getHex() : col.body2
  part(body, box(0.62, 0.72, 0.36), col.body, 0, 1.32, 0)
  part(body, box(0.68, 0.26, 0.4), col.body2, 0, 1.14, 0)
  if (modern) {
    part(body, box(0.7, 0.42, 0.44), col.body2, 0, 1.44, 0)
    part(body, box(0.2, 0.26, 0.08), accent, -0.21, 1.45, 0.24)
    part(body, box(0.15, 0.18, 0.12), col.metal, 0.28, 1.44, 0.2)
  } else {
    part(body, box(0.06, 0.42, 0.3), accent, -0.34, 1.36, 0)
    part(body, box(0.38, 0.42, 0.3), col.body2, 0, 1.36, 0.28)
  }
  part(body, box(0.16, 0.5, 0.16), C.skin, 0.4, 1.31, 0.02, 0, 0, -0.08)
  part(body, box(0.16, 0.5, 0.16), C.skin, -0.4, 1.31, 0.02, 0, 0, 0.08)
  part(body, sphere(0.25, 8), C.skin, 0, 1.85, 0.02)
  part(body, box(0.22, 0.1, 0.12), C.skinDark, 0, 1.74, 0.2)
  if (modern) {
    part(body, box(0.56, 0.24, 0.52), helmetColor, 0, 1.96, 0)
    part(body, box(0.46, 0.12, 0.14), C.glass, 0, 1.93, 0.25)
    part(body, box(0.1, 0.06, 0.06), accent, 0.3, 1.99, 0.05)
  } else if (unit.era === 'ww2') {
    part(body, sphere(0.3, 8), helmetColor, 0, 1.94, 0)
    part(body, box(0.58, 0.07, 0.62), helmetColor, 0, 1.84, 0)
  } else {
    part(body, cyl(0.32, 0.34, 0.16, 8), helmetColor, 0, 1.9, 0)
    part(body, sphere(0.26, 8), helmetColor, 0, 1.98, 0)
    part(body, box(0.55, 0.06, 0.55), helmetColor, 0, 1.89, 0)
  }
  // rifle
  const rifleY = 1.38
  const rifleZ = 0.35
  if (unit.key === 'marksman') {
    part(body, box(0.07, 0.09, 1.35), C.dark, 0.18, rifleY, rifleZ + 0.25)
    part(body, box(0.16, 0.1, 0.26), C.dark, 0.18, rifleY + 0.08, rifleZ + 0.3)
    part(body, box(0.1, 0.12, 0.08), C.glass, 0.18, rifleY + 0.11, rifleZ + 0.18)
    part(body, box(0.05, 0.05, 0.6), C.metalDark, 0.18, rifleY - 0.02, rifleZ + 0.95)
  } else if (unit.key === 'gunner') {
    part(body, box(0.16, 0.16, 1.1), C.metalDark, 0.22, rifleY - 0.02, rifleZ + 0.25)
    part(body, box(0.24, 0.26, 0.32), C.dark, 0.22, rifleY - 0.08, rifleZ - 0.2)
    part(body, box(0.05, 0.4, 0.05), C.metalDark, 0.38, rifleY - 0.32, rifleZ + 0.5)
    part(body, box(0.05, 0.4, 0.05), C.metalDark, 0.06, rifleY - 0.32, rifleZ + 0.5)
  } else if (unit.key === 'engineer') {
    part(body, box(0.44, 0.5, 0.26), col.body2, 0, 1.32, -0.3)
    part(body, box(0.08, 0.08, 0.3), C.metal, 0.28, 1.0, -0.3)
    part(body, box(0.07, 0.08, 0.9), C.dark, 0.2, rifleY, rifleZ + 0.18)
  } else {
    part(body, box(0.08, 0.1, 1.05), C.dark, 0.2, rifleY, rifleZ + 0.18)
    part(body, box(0.1, 0.16, 0.34), C.wood, 0.2, rifleY - 0.03, rifleZ - 0.2)
  }
  const bodyMesh = mesh(body)
  g.add(bodyMesh)
  // animated legs
  const legGeo = () => {
    const parts = []
    part(parts, box(0.24, 0.66, 0.28), col.body2, 0, -0.33, 0)
    part(parts, box(0.27, 0.2, 0.34), C.dark, 0, -0.6, 0.08)
    return parts
  }
  const legL = mesh(legGeo())
  const legR = mesh(legGeo())
  legL.position.set(-0.2, 0.86, 0)
  legR.position.set(0.2, 0.86, 0)
  g.add(legL, legR)
  g.userData.legL = legL
  g.userData.legR = legR
  g.userData.kind = 'soldier'
  g.scale.setScalar(modern ? 1.03 : 1)
  g.userData.height = 2.35
  return g
}

// ── ground vehicles ─────────────────────────────────────────────────────────
function wheels(parts, count, width, radius, zSpan, y, color = C.rubber) {
  const geo = cyl(radius, radius, width, 8)
  for (let i = 0; i < count / 2; i++) {
    const z = count === 4 ? (i === 0 ? zSpan * 0.5 : -zSpan * 0.5) : lerpRange(-zSpan / 2, zSpan / 2, i / Math.max(1, count / 2 - 1))
    part(parts, geo, color, width * 0.5 + 0.02, y, z, 0, 0, Math.PI / 2)
    part(parts, geo, color, -width * 0.5 - 0.02, y, z, 0, 0, Math.PI / 2)
  }
}
function lerpRange(a, b, t) { return a + (b - a) * t }

function vehicleModel(unit) {
  const col = eraColors(unit)
  const g = new THREE.Group()
  const parts = []
  const kind = unit.key
  const ww1 = unit.era === 'ww1'
  const modern = unit.era === 'modern'
  const len = kind === 'recon' ? 4.6 : kind === 'apc' ? 6.2 : 6.8
  const wid = kind === 'recon' ? 2.0 : 2.55
  const wheelR = kind === 'recon' ? 0.5 : 0.58
  const hullY = wheelR + 0.55
  if (kind === 'recon') {
    part(parts, box(wid, 0.55, len * 0.88), col.body, 0, hullY, 0)
    part(parts, box(wid * 0.88, 0.5, 1.5), col.body2, 0, hullY + 0.42, -0.7)
    part(parts, box(wid * 0.92, 0.16, len * 0.9), col.accent, 0, hullY + 0.28, 0)
    part(parts, box(0.8, 0.34, 0.08), C.glass, 0, hullY + 0.65, -1.4)
    if (modern) {
      part(parts, box(0.36, 0.2, 0.5), col.metal, -0.5, hullY + 0.9, 0.8)
      part(parts, cyl(0.07, 0.07, 0.38, 5), C.metalDark, -0.5, hullY + 1.03, 0.9)
    } else {
      part(parts, cyl(0.38, 0.4, 0.3, 8), col.metal, 0, hullY + 0.38, 1.1)
      part(parts, cyl(0.06, 0.06, 0.75, 5), C.metalDark, 0, hullY + 0.48, 1.45, Math.PI / 2, 0, 0)
    }
    wheels(parts, modern ? 4 : 4, wid + 0.12, wheelR, len * 0.55, wheelR)
    part(parts, box(0.1, 0.04, 0.1), C.white, -0.78, hullY + 0.3, 1.8)
    part(parts, box(0.1, 0.04, 0.1), C.white, 0.78, hullY + 0.3, 1.8)
  } else if (kind === 'apc') {
    part(parts, box(wid, 0.7, len), col.body, 0, hullY, 0)
    part(parts, box(wid * 0.92, 1.0, len * 0.68), col.body2, 0, hullY + 0.72, -0.28)
    // sloped front
    part(parts, box(wid * 0.9, 0.5, 1.35), col.body, 0, hullY + 0.4, len * 0.47, -0.42, 0, 0)
    part(parts, box(wid * 0.94, 0.08, len * 0.7), col.accent, 0, hullY + 0.24, 0)
    part(parts, box(wid * 0.6, 0.38, 0.08), C.glass, 0, hullY + 1.0, len * 0.36)
    if (ww1) {
      part(parts, box(wid + 0.1, 0.6, len * 0.6), C.wood, 0, hullY + 0.45, -0.6)
    }
    if (modern) {
      part(parts, box(wid * 0.75, 0.14, len * 0.5), col.camo, 0, hullY + 1.3, -0.2)
      part(parts, box(0.45, 0.3, 1.1), col.metal, 0.5, hullY + 1.35, -0.1)
      part(parts, box(0.16, 0.16, 0.7), C.metalDark, 0.5, hullY + 1.42, 0.5)
    } else {
      part(parts, cyl(0.32, 0.4, 0.4, 8), col.metal, 0, hullY + 1.3, -0.2)
      part(parts, box(0.09, 0.09, 0.8), C.metalDark, 0, hullY + 1.38, 0.35)
    }
    wheels(parts, modern ? 8 : ww1 ? 4 : 6, wid + 0.08, wheelR, len * 0.6, wheelR)
    if (!modern && !ww1) {
      // rear track section for halftrack
      part(parts, box(0.5, 0.8, 1.8), C.track, wid * 0.5 + 0.2, wheelR + 0.1, -1.4)
      part(parts, box(0.5, 0.8, 1.8), C.track, -wid * 0.5 - 0.2, wheelR + 0.1, -1.4)
    }
  } else {
    // artillery / towed gun platform
    part(parts, box(wid, 0.5, len * 0.9), col.body, 0, hullY, -0.2)
    part(parts, box(wid * 0.85, 0.7, 1.8), col.body2, 0, hullY + 0.5, 0.8)
    part(parts, box(wid * 0.6, 0.14, 0.08), C.glass, 0, hullY + 0.75, 1.68)
    part(parts, box(wid + 0.3, 0.16, len * 0.7), col.accent, 0, hullY + 0.28, -0.6)
    if (ww1) part(parts, box(wid + 0.4, 0.3, len * 0.55), C.wood, 0, hullY + 0.3, -1.5)
    wheels(parts, 4, wid + 0.15, wheelR, len * 0.5, wheelR)
    // gun assembly
    part(parts, cyl(0.45, 0.55, 0.42, 8), col.metal, 0, hullY + 0.7, -1.45)
    part(parts, box(0.5, 0.5, 1.2), col.metal, 0, hullY + 0.78, -0.8)
    part(parts, cyl(0.11, 0.15, 2.8, 6), C.metalDark, 0, hullY + 1.05, -2.2, -0.28, 0, 0)
    part(parts, cyl(0.18, 0.18, 0.5, 6), C.metalDark, 0, hullY + 1.43, -3.45, -0.28, 0, 0)
    if (unit.era === 'modern') {
      part(parts, box(1.3, 0.9, 2.4), col.camo, 0, hullY + 0.95, -0.4)
      part(parts, box(0.4, 0.4, 0.8), col.metal, 0.65, hullY + 1.35, -0.3)
    }
  }
  const hull = mesh(parts)
  g.add(hull)
  g.userData.kind = 'vehicle'
  g.userData.height = 2.4
  return g
}

// ── tanks ───────────────────────────────────────────────────────────────────
function tankModel(unit) {
  const col = eraColors(unit)
  const g = new THREE.Group()
  const hull = []
  const ww1 = unit.era === 'ww1'
  const modern = unit.era === 'modern'
  const cls = unit.key
  const heavyScale = cls === 'heavy' ? 1.13 : cls === 'light' ? 0.88 : 1
  const len = (ww1 ? 7.6 : 6.7) * heavyScale
  const wid = (ww1 ? 3.7 : 3.25) * heavyScale
  const trackW = 0.62 * heavyScale
  const hullY = 1.03 * heavyScale
  const trackY = 0.62 * heavyScale
  const trackH = ww1 ? 1.45 : 0.95
  // tracks
  part(hull, box(trackW, trackH, len * 1.02), C.track, wid / 2 + trackW / 2, trackY, 0)
  part(hull, box(trackW, trackH, len * 1.02), C.track, -wid / 2 - trackW / 2, trackY, 0)
  for (let i = 0; i < 5; i++) {
    const z = -len * 0.38 + (len * 0.76 * i) / 4
    part(hull, cyl(0.32 * heavyScale, 0.32 * heavyScale, trackW + 0.06, 8), C.metalDark, wid / 2 + trackW / 2, trackY, z, 0, 0, Math.PI / 2)
    part(hull, cyl(0.32 * heavyScale, 0.32 * heavyScale, trackW + 0.06, 8), C.metalDark, -wid / 2 - trackW / 2, trackY, z, 0, 0, Math.PI / 2)
  }
  if (ww1) {
    // rhomboid landships
    part(hull, box(wid, 1.45 * heavyScale, len), col.body, 0, 1.35 * heavyScale, 0)
    part(hull, box(wid * 0.96, 1.0, len * 0.8), col.body2, 0, 2.05 * heavyScale, -0.2)
    part(hull, box(1.0, 0.7, 1.3), col.metal, wid * 0.5 + 0.15, 1.45 * heavyScale, 0.6)
    part(hull, box(1.0, 0.7, 1.3), col.metal, -wid * 0.5 - 0.15, 1.45 * heavyScale, 0.6)
    part(hull, cyl(0.08, 0.1, 1.2, 5), C.metalDark, wid * 0.5 + 0.15, 1.45 * heavyScale, 0.6, Math.PI / 2, 0, 0)
    part(hull, cyl(0.08, 0.1, 1.2, 5), C.metalDark, -wid * 0.5 - 0.15, 1.45 * heavyScale, 0.6, Math.PI / 2, 0, 0)
    part(hull, box(wid * 0.8, 0.2, 0.4), col.accent, 0, 2.55 * heavyScale, 1.6)
    part(hull, box(0.1, 1.1, 0.1), C.metalDark, wid * 0.26, 2.9 * heavyScale, -1.4)
  } else if (modern) {
    part(hull, box(wid, 0.92, len), col.body, 0, hullY, 0)
    part(hull, box(wid * 0.92, 0.6, len * 0.82), col.camo, 0, hullY + 0.7, -0.25)
    part(hull, box(wid * 0.94, 0.55, 1.2), col.body, 0, hullY + 0.2, len * 0.48, -0.48, 0, 0)
    part(hull, box(wid * 1.02, 0.16, len * 0.85), col.metal, 0, hullY - 0.36, 0)
    for (let i = 0; i < 4; i++) {
      part(hull, box(0.45, 0.24, 0.7), col.body2, wid * 0.33, hullY + 0.75, -1.3 + i * 0.9)
      part(hull, box(0.45, 0.24, 0.7), col.body2, -wid * 0.33, hullY + 0.75, -1.3 + i * 0.9)
    }
    part(hull, box(0.24, 0.16, 0.75), C.metalDark, wid * 0.42, hullY + 0.6, 1.5)
    part(hull, box(0.24, 0.16, 0.75), C.metalDark, -wid * 0.42, hullY + 0.6, 1.5)
    part(hull, cyl(0.05, 0.05, 2.2, 4), C.metalDark, -wid * 0.35, hullY + 1.4, -1.4)
    part(hull, box(0.06, 0.06, 0.45), col.accent, -wid * 0.35, hullY + 2.45, -1.4)
  } else {
    part(hull, box(wid, 0.9, len), col.body, 0, hullY, 0)
    part(hull, box(wid * 0.86, 0.55, len * 0.7), col.body2, 0, hullY + 0.65, -0.1)
    part(hull, box(wid * 0.9, 0.6, 1.15), col.body, 0, hullY + 0.18, len * 0.46, -0.5, 0, 0)
    part(hull, box(wid * 1.04, 0.18, len * 0.9), col.metal, 0, hullY - 0.36, 0)
    part(hull, box(wid * 0.88, 0.32, 0.28), C.wood, 0, hullY + 0.55, -len * 0.46)
    part(hull, box(wid * 0.6, 0.18, 0.18), col.accent, 0, hullY + 0.55, len * 0.3)
    part(hull, box(0.16, 0.16, 0.6), C.metalDark, wid * 0.4, hullY + 0.65, -1.2)
    part(hull, box(0.16, 0.16, 0.6), C.metalDark, -wid * 0.4, hullY + 0.65, -1.2)
  }
  g.add(mesh(hull))

  // turret (separate so it can track targets)
  const turret = []
  const turretY = ww1 ? 2.55 * heavyScale : modern ? 1.86 : 1.78
  const turretScale = cls === 'heavy' ? 1.16 : cls === 'light' ? 0.85 : 1
  if (ww1) {
    part(turret, cyl(0.85, 0.95, 0.6, 8), col.body2, 0, 0, -0.3)
    part(turret, box(0.9, 0.4, 1.2), col.body2, 0, 0.1, 0.4)
    part(turret, cyl(0.08, 0.11, 2.4, 6), C.metalDark, 0, 0.16, 1.45, Math.PI / 2, 0, 0)
  } else if (modern) {
    part(turret, box(2.1 * turretScale, 0.62, 2.7 * turretScale), col.body, 0, 0, -0.15)
    part(turret, box(1.55 * turretScale, 0.36, 1.5 * turretScale), col.body2, 0, 0.42, -0.4)
    part(turret, box(0.85, 0.22, 0.7), col.metal, 0.55, 0.48, -0.1)
    part(turret, box(0.3, 0.2, 0.35), C.glass, 0.55, 0.58, 0.1)
    part(turret, cyl(0.1, 0.13, 3.7 * turretScale, 6), C.metalDark, 0, 0.1, 2.1 * turretScale, Math.PI / 2, 0, 0)
    part(turret, cyl(0.16, 0.16, 0.5, 6), C.metalDark, 0, 0.1, 3.9 * turretScale, Math.PI / 2, 0, 0)
    part(turret, box(0.18, 0.18, 0.55), col.accent, -0.75, 0.5, -0.1)
    part(turret, box(0.18, 0.18, 0.55), col.accent, 0.75, 0.5, -0.1)
  } else {
    part(turret, cyl(1.05 * turretScale, 1.22 * turretScale, 0.72, 8), col.body2, 0, 0.06, -0.2)
    part(turret, box(1.2 * turretScale, 0.55, 1.45 * turretScale), col.body, 0, 0.34, 0.15)
    part(turret, box(0.5, 0.24, 0.42), col.metal, 0.45, 0.56, -0.35)
    part(turret, cyl(0.11, 0.15, 3.0 * turretScale, 6), C.metalDark, 0, 0.28, 1.75 * turretScale, Math.PI / 2, 0, 0)
    part(turret, cyl(0.18, 0.18, 0.4, 6), C.metalDark, 0, 0.28, 3.2 * turretScale, Math.PI / 2, 0, 0)
    part(turret, box(0.1, 0.6, 0.1), C.metalDark, -0.6, 0.8, -0.7)
  }
  const turretMesh = mesh(turret)
  turretMesh.position.set(0, turretY, -0.2)
  g.add(turretMesh)
  const muzzle = new THREE.Object3D()
  muzzle.position.set(0, ww1 ? 0.16 : modern ? 0.1 : 0.28, (ww1 ? 2.6 : modern ? 4.05 : 3.35) * (modern ? turretScale : 1))
  turretMesh.add(muzzle)
  g.userData.turret = turretMesh
  g.userData.muzzle = muzzle
  g.userData.kind = 'tank'
  g.userData.height = 3.4 * heavyScale
  return g
}

// ── aircraft ────────────────────────────────────────────────────────────────
function planeModel(unit) {
  const col = eraColors(unit)
  const g = new THREE.Group()
  const parts = []
  const propParts = []
  const modern = unit.era === 'modern'
  const ww1 = unit.era === 'ww1'
  const bomber = unit.key === 'bomber'
  const len = bomber ? 11 : 8
  const span = bomber ? (modern ? 11 : 13) : (modern ? 7.5 : 8.5)
  const bodyR = bomber ? 0.72 : 0.55
  const bodyColor = col.body
  // fuselage + nose
  part(parts, cyl(bodyR * 0.7, bodyR, len * 0.82, 8), bodyColor, 0, 0, 0, Math.PI / 2, 0, 0)
  part(parts, cone(bodyR * 0.72, bomber ? 1.4 : 2.2, 8), bodyColor, 0, 0, len * 0.5 + (bomber ? 0.4 : 0.8), Math.PI / 2, 0, 0)
  part(parts, box(bodyR * 1.1, bodyR * 0.55, len * 0.16), C.glass, 0, bodyR * 0.55, len * 0.18)
  // wings
  const wingThickness = bomber ? 0.3 : 0.22
  const rootChord = bomber ? 3.2 : 2.2
  const tipChord = bomber ? 2.1 : 1.1
  const sweep = modern ? (bomber ? 2.2 : 2.6) : ww1 ? 0 : 0.4
  const wing = makeWingGeometry(span / 2, rootChord, tipChord, sweep, wingThickness)
  part(parts, wing, col.body2, 0, ww1 ? 0.85 : 0.1, -0.15)
  if (ww1) {
    part(parts, wing, col.body2, 0, -0.05, -0.15)
    for (const x of [-span * 0.32, span * 0.32]) {
      part(parts, box(0.08, 0.95, 0.08), C.metalDark, x, 0.4, 0.2)
      part(parts, box(0.08, 0.95, 0.08), C.metalDark, x, 0.4, -1.2)
    }
  }
  // tail
  part(parts, box(span * 0.32, 0.12, bomber ? 2.4 : 1.7), col.body2, 0, 0.15, -len * 0.42)
  part(parts, box(0.16, bomber ? 1.8 : 1.35, bomber ? 1.5 : 1.1), col.body2, 0, bomber ? 0.7 : 0.55, -len * 0.43)
  if (modern) {
    part(parts, box(0.16, 1.1, 1.0), col.body2, -0.7, 0.5, -len * 0.4, 0, 0, -0.28)
    part(parts, box(0.16, 1.1, 1.0), col.body2, 0.7, 0.5, -len * 0.4, 0, 0, 0.28)
    part(parts, box(0.36, 0.22, 0.9), col.accent, 0, 0.04, -len * 0.37)
  }
  // engines / propellers
  if (modern) {
    part(parts, cyl(0.36, 0.4, 1.3, 8), C.metalDark, 0, 0, -len * 0.46, Math.PI / 2, 0, 0)
    part(parts, cyl(0.27, 0.32, 1.1, 8), C.metalDark, 0, 0, -len * 0.5, Math.PI / 2, 0, 0)
    if (bomber) {
      for (const x of [-span * 0.32, span * 0.32]) {
        part(parts, cyl(0.3, 0.34, 1.8, 8), C.metalDark, x, -0.25, -0.3, Math.PI / 2, 0, 0)
        part(parts, cyl(0.26, 0.28, 0.3, 8), C.metalDark, x, -0.25, 0.65, Math.PI / 2, 0, 0)
      }
    }
    part(parts, box(0.16, 0.14, 2.2), col.accent, -span * 0.42, -0.04, -0.3)
    part(parts, box(0.16, 0.14, 2.2), col.accent, span * 0.42, -0.04, -0.3)
  } else {
    const propZ = len * 0.5 + (bomber ? 1.1 : 1.9)
    part(parts, cyl(0.16, 0.22, 0.5, 8), C.metalDark, 0, 0, propZ - 0.4, Math.PI / 2, 0, 0)
    const blade = box(0.13, 2.2, 0.12)
    part(propParts, blade, C.metalDark, 0, 0, 0)
    part(propParts, blade, C.metalDark, 0, 0, 0, 1.05, 0, 0)
    if (bomber) {
      for (const x of [-span * 0.34, span * 0.34]) {
        part(parts, cyl(0.34, 0.4, 2.2, 8), C.metalDark, x, -0.1, 0.1, Math.PI / 2, 0, 0)
        part(propParts, box(0.12, 1.5, 0.1), C.metalDark, x, -0.1, 1.25, Math.PI / 2, 0, 0)
      }
    }
  }
  // landing gear / details
  if (!modern) {
    part(parts, cyl(0.06, 0.06, 1.0, 5), C.metalDark, -span * 0.18, -0.55, 0.2)
    part(parts, cyl(0.06, 0.06, 1.0, 5), C.metalDark, span * 0.18, -0.55, 0.2)
    part(parts, cyl(0.16, 0.16, 0.14, 8), C.rubber, -span * 0.18, -1.05, 0.2, 0, 0, Math.PI / 2)
    part(parts, cyl(0.16, 0.16, 0.14, 8), C.rubber, span * 0.18, -1.05, 0.2, 0, 0, Math.PI / 2)
  }
  const hullMesh = mesh(parts)
  g.add(hullMesh)
  if (!modern) {
    const prop = new THREE.Mesh(merge(propParts), UNIT_MATERIAL)
    prop.position.set(0, 0, len * 0.5 + (bomber ? 1.35 : 2.15))
    prop.castShadow = true
    g.add(prop)
    g.userData.prop = prop
  }
  // nav lights
  const lightParts = []
  part(lightParts, box(0.18, 0.1, 0.2), 0xe36a4a, -span * 0.46, 0.15, -0.6)
  part(lightParts, box(0.18, 0.1, 0.2), 0x63d6b0, span * 0.46, 0.15, -0.6)
  const nav = new THREE.Mesh(merge(lightParts), new THREE.MeshBasicMaterial({ vertexColors: true }))
  g.add(nav)
  g.userData.kind = 'plane'
  g.userData.height = 2
  g.userData.aircraft = true
  return g
}

export function createUnitModel(unit) {
  let model
  if (unit.category === 'soldier') model = soldierModel(unit)
  else if (unit.category === 'vehicle') model = vehicleModel(unit)
  else if (unit.category === 'plane') model = planeModel(unit)
  else model = tankModel(unit)
  model.traverse(o => {
    if (o.isMesh) {
      o.castShadow = true
      o.receiveShadow = true
    }
  })
  return model
}

// ── buildings ───────────────────────────────────────────────────────────────
function gableRoof(w, d, color, y, parts, steep = 0.55) {
  part(parts, box(w, 0.16, d / 2 + 0.3), color, 0, y, -d / 4, steep, 0, 0)
  part(parts, box(w, 0.16, d / 2 + 0.3), color, 0, y, d / 4, -steep, 0, 0)
}

function createBuildingModel(building, faction) {
  const g = new THREE.Group()
  const parts = []
  const f = faction.colors
  const era = building.era
  const key = building.key
  const colBody = new THREE.Color(f.primary).multiplyScalar(era === 'modern' ? 0.58 : 0.92).getHex()
  const colTrim = new THREE.Color(f.secondary).multiplyScalar(0.85).getHex()
  const colDark = era === 'modern' ? 0x2c3230 : era === 'ww2' ? 0x4a4a3e : 0x554f3c
  const colSand = era === 'ww1' ? C.sandbag : era === 'ww2' ? 0x6f6a54 : 0x5d635c
  const colRoof = era === 'ww1' ? 0x5c523c : era === 'ww2' ? 0x4c4a3d : 0x444b49
  const accent = f.accent

  if (key === 'hq') {
    part(parts, box(15, 0.6, 13), colDark, 0, 0.3, 0)
    part(parts, box(11, 3.6, 9), colBody, 0, 2.5, 0)
    part(parts, box(11.8, 0.5, 9.8), colRoof, 0, 4.45, 0)
    part(parts, box(5.4, 3.0, 5.0), colTrim, -4.8, 2.1, 5.3)
    part(parts, box(5.8, 0.34, 5.4), colRoof, -4.8, 3.68, 5.3)
    part(parts, box(2.0, 2.2, 0.2), C.glass, 1.8, 2.2, 4.52)
    part(parts, box(1.2, 2.6, 0.25), colDark, -1.6, 1.7, 4.53)
    part(parts, box(2.4, 1.5, 0.18), C.glass, 3.7, 2.8, 4.5)
    // radio mast
    part(parts, cyl(0.12, 0.2, 8.5, 6), C.metalDark, 4.2, 8.0, -3.4)
    part(parts, box(2.4, 0.08, 0.08), C.metalDark, 4.2, 10.0, -3.4)
    part(parts, box(0.08, 0.08, 2.4), C.metalDark, 4.2, 9.4, -3.4)
    part(parts, cyl(0.7, 0.9, 0.35, 10), C.metal, -4.5, 5.1, -3.0)
    // sandbags
    for (let i = 0; i < 9; i++) {
      part(parts, box(1.5, 0.55, 0.6), colSand, -6 + i * 1.5, 0.75, 6.7, 0, 0, 0.02)
      part(parts, box(1.5, 0.55, 0.6), colSand, -6 + i * 1.5, 1.25, 6.75, 0, 0.05, -0.02)
    }
    part(parts, box(3.2, 0.1, 0.5), accent, 0, 4.7, 4.95)
    if (era === 'modern') {
      part(parts, box(2.6, 1.4, 1.2), 0x3f4745, 4.0, 1.9, 5.0)
      part(parts, cyl(0.14, 0.18, 2.2, 6), C.metalDark, 5.0, 3.4, 5.0)
    }
  } else if (key === 'barracks') {
    part(parts, box(10, 0.4, 7), colDark, 0, 0.2, 0)
    part(parts, box(8.5, 2.4, 5.2), colBody, 0, 1.6, 0)
    gableRoof(9.2, 5.8, colRoof, 3.0, parts, era === 'modern' ? 0.3 : 0.52)
    part(parts, box(1.2, 2.0, 0.16), colDark, -2.4, 1.25, 2.62)
    part(parts, box(1.0, 0.7, 0.14), C.glass, 1.6, 1.9, 2.62)
    part(parts, box(1.0, 0.7, 0.14), C.glass, 2.8, 1.9, 2.62)
    part(parts, box(0.18, 2.6, 0.18), C.wood, 3.9, 1.5, 3.0)
    part(parts, box(2.0, 0.7, 0.1), accent, 3.9, 2.7, 3.05)
    for (let i = 0; i < 4; i++) part(parts, box(1.3, 0.5, 0.55), colSand, -4.5 + i * 1.4, 0.65, 3.6, 0, 0, 0.03)
    part(parts, box(1.2, 0.8, 1.2), 0x5e543e, 4.6, 0.8, -1.8)
    part(parts, box(0.9, 0.6, 0.9), 0x5e543e, 5.3, 0.4, -1.0)
    if (era === 'ww1') {
      // tents
      part(parts, cone(2.4, 2.2, 5), 0x8c8264, 0, 1.1, -4.8, 0, 0.4, 0)
      part(parts, cone(1.8, 1.8, 5), 0x81785c, 4.8, 0.9, -4.4, 0, 0.2, 0)
    }
  } else if (key === 'factory') {
    part(parts, box(15, 0.5, 11), colDark, 0, 0.25, 0)
    part(parts, box(13, 4.2, 9), colBody, 0, 2.6, 0)
    part(parts, box(14, 0.5, 10), colRoof, 0, 4.95, 0)
    part(parts, box(4.6, 3.1, 0.2), C.metalDark, 2.0, 2.0, 4.55)
    for (let i = 0; i < 5; i++) part(parts, box(0.18, 2.6, 0.1), C.metal, -0.1 + i * 0.9, 2.0, 4.62)
    part(parts, box(1.8, 1.0, 0.2), C.glass, -4.2, 3.0, 4.55)
    part(parts, box(2.0, 1.3, 0.2), C.glass, -1.9, 3.0, 4.55)
    part(parts, cyl(1.0, 1.2, 11, 8), 0x4b4a41, -5.4, 7.5, -3.0)
    part(parts, cyl(1.15, 1.3, 0.8, 8), 0x3c3b35, -5.4, 13.0, -3.0)
    part(parts, box(0.5, 8, 0.4), C.metalDark, 5.4, 5.0, -4.0)
    part(parts, box(5.2, 0.35, 0.35), C.metalDark, 3.2, 8.9, -4.0)
    part(parts, box(0.12, 1.4, 0.12), C.metalDark, 2.0, 8.2, -4.0)
    part(parts, box(3.0, 0.12, 0.6), accent, 0, 5.25, 4.75)
    part(parts, box(1.4, 1.2, 1.4), 0x6d6350, 4.8, 0.8, 3.6)
  } else if (key === 'airfield') {
    part(parts, box(20, 0.3, 14), 0x55564a, 0, 0.15, 0)
    for (let i = 0; i < 7; i++) part(parts, box(1.8, 0.02, 0.35), 0xd7cfa8, -7.2 + i * 2.4, 0.33, 0)
    part(parts, box(11, 3.6, 7), colBody, 0, 2.0, -1.0)
    // curved hangar roof
    part(parts, cyl(5.3, 5.3, 8.2, 12, 1, true, 0, Math.PI), colRoof, 0, 3.8, -1.0, 0, 0, Math.PI / 2)
    part(parts, box(5.0, 2.7, 0.2), C.metalDark, 0, 1.5, 2.55)
    part(parts, box(4.8, 0.5, 1.0), C.metal, 0, 3.1, 2.7)
    part(parts, box(3.2, 5.5, 3.2), colTrim, 7.8, 2.9, 3.2)
    part(parts, box(3.6, 0.35, 3.6), colRoof, 7.8, 5.7, 3.2)
    part(parts, box(2.6, 1.2, 0.15), C.glass, 7.8, 4.2, 4.8)
    part(parts, cyl(0.1, 0.12, 4.5, 5), C.metalDark, -7.5, 4.2, 4.0)
    part(parts, cone(0.5, 1.5, 5), 0xc25a45, -7.5, 6.2, 4.2, 0, 0, Math.PI / 2)
  } else if (key === 'depot') {
    part(parts, box(9, 0.35, 8), colDark, 0, 0.18, 0)
    part(parts, box(5.5, 2.3, 4.4), colBody, -1.2, 1.35, -1.2)
    gableRoof(6, 4.8, colRoof, 2.6, parts)
    part(parts, box(1.1, 1.8, 0.15), colDark, -1.2, 1.1, 1.05)
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
      part(parts, box(1.2, 0.85, 1.1), 0x675b40, 2.7 + i * 0.1, 0.55 + j * 0.88, 1.2 - i * 0.2)
      part(parts, box(1.25, 0.06, 0.15), 0x8b7a52, 2.7 + i * 0.1, 0.98 + j * 0.88, 1.2 - i * 0.2)
    }
    for (let i = 0; i < 5; i++) {
      part(parts, cyl(0.48, 0.48, 0.95, 8), i % 2 ? 0x574c36 : 0x6d5a3c, 3.7 + (i % 2) * 0.95, 0.5, -2.5 + Math.floor(i / 2) * 0.95)
    }
    part(parts, box(2.4, 0.1, 0.15), accent, -1.2, 2.6, 1.1)
  } else if (key === 'turret') {
    part(parts, cyl(3.0, 3.4, 0.7, 10), colDark, 0, 0.35, 0)
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2
      part(parts, box(1.4, 0.6, 0.75), colSand, Math.cos(a) * 3.3, 0.75, Math.sin(a) * 3.3, 0, -a + Math.PI / 2, 0)
      part(parts, box(1.35, 0.55, 0.7), colSand, Math.cos(a + 0.16) * 3.35, 1.26, Math.sin(a + 0.16) * 3.35, 0, -a + Math.PI / 2, 0)
    }
    part(parts, cyl(1.1, 1.3, 1.0, 8), colBody, 0, 1.2, 0)
    const turretParts = []
    part(turretParts, cyl(0.95, 1.15, 0.8, 8), colTrim, 0, 0.4, 0)
    part(turretParts, box(1.6, 0.7, 2.0), colBody, 0, 0.55, 0.3)
    part(turretParts, cyl(0.12, 0.17, 3.2, 6), C.metalDark, 0, 0.6, 1.9, Math.PI / 2, 0, 0)
    part(turretParts, box(0.4, 0.4, 0.5), C.metal, 0.55, 0.9, 0.1)
    const t = mesh(turretParts)
    t.position.set(0, 1.55, 0)
    g.add(t)
    const muzzle = new THREE.Object3D()
    muzzle.position.set(0, 0.6, 3.5)
    t.add(muzzle)
    g.userData.turret = t
    g.userData.muzzle = muzzle
  } else if (key === 'hospital') {
    part(parts, box(9, 0.3, 8), colDark, 0, 0.15, 0)
    if (era === 'modern') {
      part(parts, box(7, 2.8, 6), 0xd5d4c8, 0, 1.7, 0)
      part(parts, box(7.4, 0.3, 6.4), 0xb5b5a8, 0, 3.2, 0)
      part(parts, box(1.2, 2.2, 0.16), 0x707a74, 0, 1.35, 3.08)
    } else {
      part(parts, box(7, 2.2, 5), 0xb8b3a0, 0, 1.35, 0)
      gableRoof(7.5, 5.6, 0x8a877a, 2.6, parts)
      // canvas tent
      part(parts, cone(2.2, 2.0, 4), 0xbcb7a2, 4.2, 1.1, 1.0, 0, 0.4, 0)
    }
    // red cross
    part(parts, box(2.3, 0.62, 0.1), 0xb03a35, 0, 3.4, 3.12)
    part(parts, box(0.62, 2.3, 0.1), 0xb03a35, 0, 3.4, 3.12)
    part(parts, box(0.1, 2.3, 0.62), 0xb03a35, 3.52, 1.7, 0)
    part(parts, box(0.1, 0.62, 2.3), 0xb03a35, 3.52, 1.7, 0)
    part(parts, box(0.3, 6, 0.3), C.metal, -3.6, 3.0, 2.5)
    part(parts, box(2.4, 1.2, 0.08), 0xd9d5c2, -2.3, 5.4, 2.5)
    part(parts, box(1.2, 0.45, 0.1), 0xb03a35, -2.3, 5.4, 2.56)
    part(parts, box(0.45, 1.2, 0.1), 0xb03a35, -2.3, 5.4, 2.56)
  }

  const hull = mesh(parts)
  g.add(hull)
  if (key === 'hq' || key === 'barracks' || key === 'airfield') {
    if (key === 'hq') addFlag(g, faction, 0.4, 4.9, -4.0, 1.25)
    else if (key === 'barracks') addFlag(g, faction, 3.9, 3.1, 3.0, 1)
    else addFlag(g, faction, 8.5, 5.8, 1.8, 1.15)
  }
  // subtle class marker ring
  const foot = new THREE.Mesh(new THREE.RingGeometry(Math.max(3, building.size * 0.62), Math.max(3.4, building.size * 0.68), 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(f.accent), transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }))
  foot.rotation.x = -Math.PI / 2
  foot.position.y = 0.08
  g.add(foot)
  g.userData.kind = 'building'
  g.userData.height = key === 'hq' ? 11 : key === 'factory' ? 14 : 8
  return g
}

export function createWreck(unitOrBuilding) {
  const src = unitOrBuilding.model || unitOrBuilding
  const copy = src.clone(true)
  copy.traverse(o => {
    if (o.isMesh) {
      if (o.userData.isFlag) { o.visible = false; return }
      o.material = WRECK_MATERIAL
      o.castShadow = true
    }
  })
  copy.rotation.x = unitOrBuilding.category === 'plane' ? 0.25 : 0
  copy.rotation.z = (Math.random() - 0.5) * 0.3
  copy.position.y -= unitOrBuilding.category === 'plane' ? 0 : 0.15
  return copy
}

export function createSelectionRing(radius, color = 0x9fe3c8) {
  const geo = new THREE.RingGeometry(radius * 0.8, radius, 30)
  geo.rotateX(-Math.PI / 2)
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide })
  const ring = new THREE.Mesh(geo, mat)
  ring.position.y = 0.12
  ring.renderOrder = 3
  return ring
}

export function createGroundMarker(radius, color = 0x9fe3c8) {
  const geo = new THREE.RingGeometry(radius * 0.72, radius, 32)
  geo.rotateX(-Math.PI / 2)
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide })
  const ring = new THREE.Mesh(geo, mat)
  ring.position.y = 0.1
  ring.renderOrder = 3
  return ring
}

export function createMuzzleFlash(color = 0xffd58a) {
  const geo = new THREE.SphereGeometry(0.42, 6, 4)
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })
  return new THREE.Mesh(geo, mat)
}

export { UNIT_MATERIAL, WRECK_MATERIAL, SHADOW_MATERIAL, GLOW_MATERIAL, flagTexture, C }
