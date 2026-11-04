import * as THREE from 'three'

export const TEAM_COLOR = { player: 0x7ad9c5, enemy: 0xe0705a }
export const TEAM_UI = { player: '#7ad9c5', enemy: '#e0705a' }
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v
export const lerp = (a, b, t) => a + (b - a) * t
export const smoothstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}
export const normAngle = (a) => {
  while (a > Math.PI) a -= Math.PI * 2
  while (a < -Math.PI) a += Math.PI * 2
  return a
}
export const approachAngle = (a, b, step) => a + clamp(normAngle(b - a), -step, step)

export const _v1 = new THREE.Vector3()
export const _v2 = new THREE.Vector3()
export const _v3 = new THREE.Vector3()
export const _v4 = new THREE.Vector3()

export function entityCenter(entity, out = new THREE.Vector3()) {
  const h = entity.kind === 'building' ? (entity.def.key === 'hq' ? 5 : 3.2) : entity.def.category === 'soldier' ? 1.3 : entity.def.category === 'plane' ? 0.6 : 1.2
  return out.set(entity.x, entity.model.position.y + h, entity.z)
}

export function entityRadius(entity) {
  if (entity.kind === 'building') return entity.def.size * 0.6
  if (entity.def.category === 'soldier') return 0.85
  if (entity.def.category === 'plane') return 4
  if (entity.def.category === 'tank') return 3.2
  return 2.6
}

export function entityCanBeHitBy(entity, attacker) {
  if (entity.dead) return false
  if (entity.aircraft && !attacker.def.canHitAir) return false
  return true
}
