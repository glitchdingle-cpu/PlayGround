import * as THREE from 'three'
import { createUnitModel, createBuildingModel, createSelectionRing } from './models.js'
import { TEAM_COLOR, approachAngle, clamp, entityCenter, entityRadius, normAngle } from './util.js'

const _v = new THREE.Vector3()
const _v2 = new THREE.Vector3()
const _v3 = new THREE.Vector3()

export class Unit {
  constructor(game, def, team, x, z, opts = {}) {
    this.game = game
    this.def = def
    this.team = team
    this.kind = 'unit'
    this.hp = this.maxHp = def.hp
    this.dead = false
    this.selected = false
    this.aircraft = Boolean(def.aircraft)
    this.radius = def.category === 'soldier' ? 0.85 : def.category === 'plane' ? 4 : def.category === 'tank' ? 3.2 : 2.6
    this.model = createUnitModel(def)
    this.model.userData.entity = this
    this.model.position.set(x, game.terrain.sample(x, z) + 0.02, z)
    this.model.rotation.y = team === 'player' ? -0.7 : 2.44
    this.flyHeight = def.category === 'plane' ? (def.key === 'bomber' ? 26 : 19) : 0
    if (this.aircraft) this.model.position.y += this.flyHeight
    this.ring = createSelectionRing(this.radius * 1.25, TEAM_COLOR[team])
    this.ring.raycast = () => {}
    this.ring.visible = false
    if (this.aircraft) {
      game.scene.add(this.ring)
      this.ring.position.set(x, game.terrain.sample(x, z) + 0.15, z)
    } else {
      this.model.add(this.ring)
    }
    game.scene.add(this.model)

    this.orderType = 'idle'
    this.orderTarget = null
    this.attackTarget = null
    this.moveTarget = null
    this.repairTarget = null
    this.cooldown = Math.random() * def.rof
    this.scanTimer = Math.random() * 0.5
    this.walkPhase = Math.random() * 10
    this.seed = Math.random() * 100
    this.moving = false
    this.idleCenter = new THREE.Vector3(x, 0, z)
    this.home = new THREE.Vector3(x, 0, z)
    this.turretYaw = 0
    this.roll = 0
    this.isUnit = true
    this.builtAt = game.elapsed
  }

  get x() { return this.model.position.x }
  get z() { return this.model.position.z }
  get y() { return this.model.position.y }

  center(out = new THREE.Vector3()) { return entityCenter(this, out) }

  distanceTo(other) {
    const dx = other.x - this.x
    const dz = other.z - this.z
    if (this.aircraft && other.aircraft) {
      const cy = other.kind === 'building' ? other.model.position.y : other.model.position.y
      return Math.hypot(dx, dz, cy - this.model.position.y)
    }
    return Math.hypot(dx, dz)
  }

  canAttack(target) {
    if (!target || target.dead) return false
    if (target.aircraft && !this.def.canHitAir) return false
    return true
  }

  setSelected(v) {
    this.selected = v
    this.ring.visible = v
  }

  stop() {
    this.orderType = 'idle'
    this.orderTarget = null
    this.attackTarget = null
    this.moveTarget = null
    this.repairTarget = null
  }

  hold() {
    this.stop()
    this.orderType = 'hold'
  }

  moveTo(x, z, attackMove = false) {
    this.orderType = attackMove ? 'attackMove' : 'move'
    this.orderTarget = null
    this.attackTarget = null
    this.repairTarget = null
    this.moveTarget = new THREE.Vector3(x, 0, z)
    if (this.aircraft) this.idleCenter.set(x, 0, z)
  }

  attack(target) {
    if (!this.canAttack(target)) {
      if (target?.aircraft && !this.def.canHitAir) return false
      return false
    }
    this.orderType = 'attack'
    this.orderTarget = target
    this.attackTarget = target
    this.repairTarget = null
    this.moveTarget = null
    return true
  }

  repair(target) {
    this.orderType = 'repair'
    this.repairTarget = target
    this.orderTarget = target
    this.attackTarget = null
    this.moveTarget = null
  }

  returnToBase() {
    this.orderType = 'return'
    this.attackTarget = null
    this.orderTarget = null
    this.moveTarget = this.home.clone()
  }

  update(dt, time) {
    if (this.dead) return
    this.cooldown = Math.max(0, this.cooldown - dt)
    this.scanTimer -= dt
    if (this.attackTarget && this.attackTarget.dead) this.attackTarget = null
    if (this.orderTarget && this.orderTarget.dead) {
      if (this.orderType === 'attack' || this.orderType === 'repair') {
        this.orderType = 'idle'
        this.orderTarget = null
        this.repairTarget = null
      }
    }
    if (this.orderType === 'attack' && this.orderTarget && !this.orderTarget.dead) this.attackTarget = this.orderTarget

    if (this.aircraft) {
      this.updateAircraft(dt, time)
      this.animate(dt, time, true)
      this.updateRing(time)
      return
    }

    if (this.scanTimer <= 0) {
      this.scanTimer = 0.4 + Math.random() * 0.25
      if (!this.attackTarget && this.orderType !== 'repair') {
        const radius = this.orderType === 'attackMove' ? this.def.sight : this.def.range * 1.08
        const found = this.game.findEnemyNear(this, radius, false)
        if (found && this.canAttack(found)) {
          if (this.orderType === 'attackMove') this.attackTarget = found
          else if (this.orderType === 'attack') this.attackTarget = this.orderTarget
          else if (this.distanceTo(found) <= this.def.range + entityRadius(found)) this.attackTarget = found
        }
      }
    }

    // release auto-acquired targets that slip away from idle / hold units
    if (this.attackTarget && (this.orderType === 'idle' || this.orderType === 'hold')) {
      if (this.distanceTo(this.attackTarget) > this.def.range + entityRadius(this.attackTarget) + 5) this.attackTarget = null
    }

    let destination = null
    let target = this.attackTarget

    if (this.orderType === 'repair' && this.repairTarget && !this.repairTarget.dead) {
      const d = this.distanceTo(this.repairTarget)
      if (d > entityRadius(this.repairTarget) + 2) destination = _v.set(this.repairTarget.x, 0, this.repairTarget.z)
      else {
        this.faceTowards(this.repairTarget.x, this.repairTarget.z, dt)
        target = null
        if (this.cooldown <= 0) {
          this.cooldown = 0.55
          const heal = this.def.repair * 1.6
          this.repairTarget.hp = Math.min(this.repairTarget.maxHp, this.repairTarget.hp + heal)
          this.game.sfx.build()
          this.game.particles.burst(_v.set(this.repairTarget.x, this.repairTarget.model.position.y + 1.2, this.repairTarget.z), { count: 3, color: 0x8fd3a6, speed: 2, up: 1, gravity: 1, life: 0.5, size: 0.5 })
        }
      }
    } else if (this.orderType === 'repair') {
      this.orderType = 'idle'
      this.repairTarget = null
    }

    if (target && this.canAttack(target)) {
      const range = this.def.range + entityRadius(target) * 0.65
      const d = this.distanceTo(target)
      if (d > range) {
        if (this.orderType === 'attack' || this.orderType === 'attackMove') destination = _v.set(target.x, 0, target.z)
        if (this.orderType === 'attackMove' && !this.moveTarget) this.moveTarget = _v2.set(target.x, 0, target.z).clone()
      } else {
        this.faceTowards(target.x, target.z, dt)
        if (this.cooldown <= 0) this.fire(target)
      }
    }

    if (!destination && this.moveTarget) {
      const d = Math.hypot(this.moveTarget.x - this.x, this.moveTarget.z - this.z)
      if (d > this.radius * 0.7 + 0.8) destination = this.moveTarget
      else {
        this.moveTarget = null
        if (this.orderType === 'move' || this.orderType === 'attackMove') this.orderType = 'idle'
      }
    }

    if (destination && this.orderType !== 'hold') {
      const arrived = this.moveToward(destination.x, destination.z, dt)
      this.moving = true
      if (arrived && this.moveTarget) {
        this.moveTarget = null
        if (this.orderType === 'move' || this.orderType === 'attackMove') this.orderType = 'idle'
      }
    } else {
      this.moving = false
    }

    if (this.orderType === 'attack' && (!target || target.dead)) {
      this.orderType = 'idle'
      this.orderTarget = null
    }
    if (this.attackTarget && this.canAttack(this.attackTarget)) {
      const d = this.distanceTo(this.attackTarget)
      const range = this.def.range + entityRadius(this.attackTarget) * 0.65
      if (d <= range) {
        this.faceTowards(this.attackTarget.x, this.attackTarget.z, dt)
        if (this.cooldown <= 0) this.fire(this.attackTarget)
      }
    }
    this.aimTurret(target, dt)
    this.animate(dt, time, false)
    this.updateRing(time)
  }

  updateAircraft(dt, time) {
    if (this.scanTimer <= 0) {
      this.scanTimer = 0.45 + Math.random() * 0.2
      if (!this.attackTarget) {
        const found = this.game.findEnemyNear(this, this.def.sight, true)
        if (found && this.canAttack(found)) this.attackTarget = found
      }
    }
    const target = this.attackTarget
    let destX, destZ
    let orbiting = false
    if (target && !target.dead && this.canAttack(target)) {
      const d = this.distanceTo(target)
      const range = this.def.range + entityRadius(target)
      if (d > range * 0.88) {
        destX = target.x
        destZ = target.z
      } else {
        const angle = time * 0.65 + this.seed
        destX = target.x + Math.cos(angle) * Math.max(7, range * 0.72)
        destZ = target.z + Math.sin(angle) * Math.max(7, range * 0.72)
        orbiting = true
      }
      if (this.cooldown <= 0 && d <= range + 2) this.fire(target)
    } else if (this.moveTarget) {
      const d = Math.hypot(this.moveTarget.x - this.x, this.moveTarget.z - this.z)
      if (d < 8) {
        this.moveTarget = null
        this.idleCenter.set(this.x, 0, this.z)
        if (this.orderType === 'return' || this.orderType === 'move') this.orderType = 'idle'
      } else {
        destX = this.moveTarget.x
        destZ = this.moveTarget.z
      }
    } else {
      const angle = time * 0.22 + this.seed
      destX = this.idleCenter.x + Math.cos(angle) * 22
      destZ = this.idleCenter.z + Math.sin(angle) * 22
      orbiting = true
    }
    if (destX !== undefined) {
      const dx = destX - this.x
      const dz = destZ - this.z
      const d = Math.hypot(dx, dz)
      if (d > 0.5) {
        const speed = this.def.speed * (orbiting ? 0.7 : 1)
        const step = Math.min(d, speed * dt)
        this.model.position.x += dx / d * step
        this.model.position.z += dz / d * step
        const desired = Math.atan2(dx, dz)
        const old = this.model.rotation.y
        this.model.rotation.y = approachAngle(this.model.rotation.y, desired, dt * 2.6)
        this.model.rotation.z = clamp(normAngle(this.model.rotation.y - old) * 6, -0.35, 0.35)
        this.moving = true
      } else this.moving = false
    }
    const ground = this.game.terrain.sample(this.x, this.z)
    const targetY = Math.max(ground, this.game.map.water ? -1 : ground) + this.flyHeight + Math.sin(time * 1.3 + this.seed) * 1.2
    this.model.position.y += (targetY - this.model.position.y) * Math.min(1, dt * 2.2)
    if (this.orderType === 'attack' && (!target || target.dead)) {
      this.orderType = 'idle'
      this.orderTarget = null
    }
    this.model.rotation.x = 0
  }

  moveToward(tx, tz, dt) {
    const dx = tx - this.x
    const dz = tz - this.z
    const d = Math.hypot(dx, dz)
    if (d < 0.02) return true
    const step = Math.min(d, this.def.speed * dt)
    this.model.position.x += dx / d * step
    this.model.position.z += dz / d * step
    this.model.position.x = clamp(this.model.position.x, -212, 212)
    this.model.position.z = clamp(this.model.position.z, -212, 212)
    const gy = this.game.terrain.sample(this.x, this.z)
    this.model.position.y = gy
    this.faceTowards(tx, tz, dt)
    return step >= d - 0.05
  }

  faceTowards(tx, tz, dt) {
    const desired = Math.atan2(tx - this.x, tz - this.z)
    const rate = this.def.category === 'tank' ? 2.2 : this.def.category === 'vehicle' ? 3.2 : 5
    this.model.rotation.y = approachAngle(this.model.rotation.y, desired, dt * rate)
  }

  aimTurret(target, dt) {
    const turret = this.model.userData.turret
    if (!turret) return
    let desired = 0
    if (target && !target.dead) {
      const world = Math.atan2(target.x - this.x, target.z - this.z)
      desired = normAngle(world - this.model.rotation.y)
      this.turretYaw = approachAngle(turret.rotation.y, desired, dt * 3.4)
    } else {
      this.turretYaw = approachAngle(turret.rotation.y, 0, dt * 1.5)
    }
    turret.rotation.y = this.turretYaw
  }

  muzzleWorld() {
    if (this.model.userData.muzzle) return this.model.userData.muzzle.getWorldPosition(_v3.clone())
    const f = this.model.rotation.y
    const forward = this.def.category === 'soldier' ? 0.7 : 1.4
    return _v3.set(
      this.x + Math.sin(f) * forward,
      this.model.position.y + (this.def.category === 'soldier' ? 1.45 : 1.3),
      this.z + Math.cos(f) * forward,
    ).clone()
  }

  fire(target) {
    if (!target || target.dead) return
    this.cooldown = this.def.rof * (0.9 + Math.random() * 0.2)
    const muzzle = this.muzzleWorld()
    if (this.def.projectile === 'bullet') this.game.fireBullet(this, target, muzzle)
    else this.game.fireShell(this, target, muzzle)
    this.game.muzzleFlash(muzzle, this.def.category === 'plane' ? 0.35 : 0.55, target.x, target.z)
  }

  animate(dt, time, air) {
    if (!air) {
      const gy = this.game.terrain.sample(this.x, this.z)
      if (this.def.category === 'soldier') {
        if (this.moving) this.walkPhase += dt * 9
        const swing = this.moving ? Math.sin(this.walkPhase) * 0.55 : Math.sin(this.walkPhase) * 0.55 * Math.max(0, 1 - dt * 6)
        if (this.model.userData.legL) {
          this.model.userData.legL.rotation.x = swing
          this.model.userData.legR.rotation.x = -swing
        }
        this.model.position.y = gy + (this.moving ? Math.abs(Math.sin(this.walkPhase * 2)) * 0.05 : 0)
      } else {
        this.model.position.y = gy
      }
    }
    if (this.model.userData.prop) this.model.userData.prop.rotation.z += dt * 32
    if (air) {
      this.model.rotation.z = lerpAngle(this.model.rotation.z, this.moving ? Math.sin(time * 0.7 + this.seed) * 0.07 : 0, dt * 2)
    }
  }

  updateRing(time) {
    if (!this.ring) return
    if (this.aircraft) {
      this.ring.position.set(this.x, this.game.terrain.sample(this.x, this.z) + 0.18, this.z)
    }
    if (this.selected) this.ring.material.opacity = 0.66 + Math.sin(time * 3.2) * 0.24
  }

  takeDamage(amount, source) {
    if (this.dead) return
    this.hp -= amount
    if (source && !source.dead && source.team !== this.team) {
      if (!this.attackTarget && this.canAttack(source)) this.attackTarget = source
    }
    if (this.hp <= 0) {
      this.hp = 0
      this.game.destroyUnit(this, source)
    }
  }
}

function lerpAngle(a, b, t) {
  let d = b - a
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return a + d * t
}

export class Building {
  constructor(game, def, team, x, z, built = true) {
    this.game = game
    this.def = def
    this.kind = 'building'
    this.team = team
    this.x = x
    this.z = z
    this.built = built
    this.progress = built ? 1 : 0
    this.hp = this.maxHp = def.hp
    if (!built) this.hp = def.hp * 0.15
    this.dead = false
    this.selected = false
    this.queue = []
    this.radius = def.size * 0.62
    this.faction = team === 'player' ? game.playerFaction : game.enemyFaction
    this.model = createBuildingModel(def, this.faction)
    this.model.userData.entity = this
    this.model.position.set(x, game.terrain.sample(x, z), z)
    const towardCenter = Math.atan2(-x, -z)
    this.model.rotation.y = towardCenter + (team === 'player' ? -0.35 : 0.35)
    this.ring = createSelectionRing(this.radius * 1.1, TEAM_COLOR[team])
    this.ring.raycast = () => {}
    this.ring.visible = false
    this.ring.position.y = 0.15
    this.model.add(this.ring)
    this.model.visible = built
    game.scene.add(this.model)

    const centerDir = new THREE.Vector3(-x, 0, -z).normalize()
    this.rally = new THREE.Vector3(x + centerDir.x * (def.size * 0.8 + 5), 0, z + centerDir.z * (def.size * 0.8 + 5))
    this.turretCooldown = Math.random() * 0.6
    this.turretYaw = 0
    this.flags = []
    this.model.traverse(o => { if (o.userData?.isFlag) this.flags.push(o) })
    this.buildScaffold = null
    if (!built) this.makeScaffold()
  }

  makeScaffold() {
    const size = this.def.size * 0.82
    const geo = new THREE.BoxGeometry(size, 4.2, size)
    const edges = new THREE.EdgesGeometry(geo)
    const mat = new THREE.LineBasicMaterial({ color: this.team === 'player' ? 0x9fe3c8 : 0xe0705a, transparent: true, opacity: 0.65 })
    const line = new THREE.LineSegments(edges, mat)
    line.position.set(this.x, this.def.size > 10 ? 5 : 2.2, this.z)
    line.rotation.y = this.model.rotation.y
    this.game.scene.add(line)
    this.scaffoldGeo = geo
    this.scaffoldMat = mat
    this.buildScaffold = line
  }

  get y() { return this.model.position.y }
  get aircraft() { return false }
  center(out = new THREE.Vector3()) { return entityCenter(this, out) }
  distanceTo(other) { return Math.hypot(other.x - this.x, other.z - this.z) }
  setSelected(v) { this.selected = v; this.ring.visible = v }

  queueUnit(unit) {
    if (!this.built || this.queue.length >= 5) return false
    this.queue.push({ def: unit, progress: 0, time: unit.buildTime || 6 })
    return true
  }

  update(dt, time) {
    if (this.dead) return
    if (!this.built) {
      this.progress = Math.min(1, this.progress + dt / this.def.buildTime)
      this.hp = this.maxHp * (0.15 + this.progress * 0.85)
      if (this.buildScaffold) this.buildScaffold.material.opacity = 0.45 + Math.sin(time * 3 + this.x) * 0.25
      if (this.progress >= 1) this.completeConstruction()
    } else {
      if (this.queue.length) {
        const q = this.queue[0]
        const pop = this.game.popFor(this.team)
        if (pop.used + q.def.pop <= pop.cap) {
          q.progress += dt / q.time
          if (q.progress >= 1) {
            this.queue.shift()
            this.spawnQueued(q.def)
          }
        }
      }
      if (this.def.range && this.def.damage) this.updateTurret(dt, time)
      if (this.def.heal) this.updateHealing(dt)
    }
    this.flags.forEach((f, i) => { f.rotation.y = Math.sin(time * 2.2 + i + this.x * 0.1) * 0.14 })
    if (this.selected) this.ring.material.opacity = 0.6 + Math.sin(time * 3) * 0.25
  }

  completeConstruction() {
    this.built = true
    this.progress = 1
    this.hp = this.maxHp
    this.model.visible = true
    if (this.buildScaffold) {
      this.game.scene.remove(this.buildScaffold)
      this.scaffoldGeo.dispose()
      this.scaffoldMat.dispose()
      this.buildScaffold = null
    }
    if (this.team === 'player') {
      this.game.ui?.toast(`${this.def.name.toUpperCase()} ONLINE`, 'good')
      this.game.sfx.ready()
    } else {
      this.game.aiNotify(`ENEMY ${this.def.name.toUpperCase()} DETECTED`)
    }
    this.game.stats.built++
  }

  spawnQueued(unitDef) {
    const spot = this.game.findSpawnSpot(this.rally.x, this.rally.z, unitDef.category === 'plane' ? 6 : 2.4, this.team)
    const u = this.game.spawnUnit(unitDef, this.team, spot.x, spot.z)
    if (u) {
      const yaw = Math.atan2(-spot.x, -spot.z)
      u.model.rotation.y = yaw
      if (this.team === 'player') {
        if (unitDef.category === 'tank' || unitDef.category === 'plane') this.game.ui?.toast(`${unitDef.name.toUpperCase()} READY`)
        this.game.sfx.ready()
      }
    }
  }

  updateTurret(dt, time) {
    this.turretCooldown -= dt
    this.turretCooldown = Math.max(0, this.turretCooldown)
    const target = this.game.findEnemyNear(this, this.def.range, true)
    const turret = this.model.userData.turret
    if (target) {
      if (turret) {
        const world = Math.atan2(target.x - this.x, target.z - this.z)
        const local = normAngle(world - this.model.rotation.y)
        this.turretYaw = approachAngle(turret.rotation.y, local, dt * 2.8)
        turret.rotation.y = this.turretYaw
      }
      if (this.turretCooldown <= 0) {
        this.turretCooldown = this.def.rof * (0.9 + Math.random() * 0.2)
        const muzzle = this.model.userData.muzzle ? this.model.userData.muzzle.getWorldPosition(_v3.clone()) : _v.set(this.x, this.y + 2.4, this.z)
        this.game.fireBullet(this, target, muzzle)
        this.game.muzzleFlash(muzzle, 0.7, target.x, target.z)
      }
    }
  }

  updateHealing(dt) {
    for (const u of this.game.units) {
      if (u.team !== this.team || u.dead || u.def.category !== 'soldier') continue
      if (u.hp >= u.maxHp) continue
      if (Math.hypot(u.x - this.x, u.z - this.z) < 24) {
        u.hp = Math.min(u.maxHp, u.hp + this.def.heal * 0.9 * dt)
      }
    }
  }

  takeDamage(amount, source) {
    if (this.dead) return
    this.hp -= amount
    if (this.team === 'player') this.game.alertBase(this)
    if (this.hp <= 0) {
      this.hp = 0
      this.game.destroyBuilding(this, source)
    }
  }

  dispose() {
    if (this.buildScaffold) {
      this.game.scene.remove(this.buildScaffold)
      this.scaffoldGeo?.dispose()
      this.scaffoldMat?.dispose()
    }
  }
}
