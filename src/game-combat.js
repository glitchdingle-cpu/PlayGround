import * as THREE from 'three'
import { createMuzzleFlash, createWreck } from './models.js'
import { clamp, entityCenter, entityRadius } from './util.js'

const _center = new THREE.Vector3()
const _pos = new THREE.Vector3()

export function installCombat(proto) {
  Object.assign(proto, {
    // ── target acquisition ────────────────────────────────────────────────
    findEnemyNear(source, radius, includeAir = false) {
      let best = null
      let bestDistance = radius
      for (const unit of this.units) {
        if (unit.dead || unit.team === source.team) continue
        if (unit.aircraft && !includeAir) continue
        const distance = Math.hypot(unit.x - source.x, unit.z - source.z)
        if (distance < bestDistance) {
          best = unit
          bestDistance = distance
        }
      }
      for (const building of this.buildings) {
        if (building.dead || building.team === source.team) continue
        if (!building.built) continue
        const distance = Math.hypot(building.x - source.x, building.z - source.z)
        if (distance < bestDistance) {
          best = building
          bestDistance = distance
        }
      }
      return best
    },

    // ── projectile creation ───────────────────────────────────────────────
    fireBullet(attacker, target, muzzle) {
      const targetPoint = entityCenter(target, new THREE.Vector3())
      targetPoint.x += (Math.random() - 0.5) * 0.4
      targetPoint.y += (Math.random() - 0.5) * 0.4
      targetPoint.z += (Math.random() - 0.5) * 0.4
      const distance = muzzle.distanceTo(targetPoint)
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 5, 4),
        new THREE.MeshBasicMaterial({ color: 0xffd58a, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }),
      )
      mesh.position.copy(muzzle)
      this.scene.add(mesh)
      this.projectiles.push({
        kind: 'bullet',
        mesh,
        start: muzzle.clone(),
        end: targetPoint,
        t: 0,
        duration: clamp(distance / 260, 0.06, 0.34),
        arc: 0.25 + distance * 0.005,
        trail: false,
        target,
        source: attacker,
        damage: attacker.def.damage,
        splash: 0,
        crater: 0,
      })
      this.sfx.shoot('bullet')
    },

    fireShell(attacker, target, muzzle) {
      const kind = attacker.def.projectile || 'shell'
      const targetPoint = entityCenter(target, new THREE.Vector3())
      const groundY = this.terrain.sample(targetPoint.x, targetPoint.z)
      const end = new THREE.Vector3(targetPoint.x, Math.max(groundY + 0.5, targetPoint.y - 0.4), targetPoint.z)
      const distance = muzzle.distanceTo(end)
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(kind === 'bomb' ? 0.55 : 0.3, 6, 5),
        new THREE.MeshBasicMaterial({ color: kind === 'bomb' ? 0x3a3a33 : 0xffc477, depthWrite: false }),
      )
      mesh.position.copy(muzzle)
      this.scene.add(mesh)
      const splash = attacker.def.splash || (kind === 'bomb' ? 9 : 3.2)
      this.projectiles.push({
        kind,
        mesh,
        start: muzzle.clone(),
        end,
        t: 0,
        duration: clamp(0.35 + distance / 125, 0.35, 2.15),
        arc: kind === 'bomb' ? 3.5 : 8 + distance * 0.05,
        trail: true,
        target,
        source: attacker,
        damage: attacker.def.damage,
        splash,
        crater: attacker.def.crater || 0,
      })
      this.sfx.shoot(kind === 'bomb' ? 'bomb' : 'shell')
    },

    spawnArtilleryRound(strike) {
      const x = strike.x
      const z = strike.z
      const ground = this.terrain.sample(x, z)
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.55, 6, 5),
        new THREE.MeshBasicMaterial({ color: 0xffd58a, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }),
      )
      const start = new THREE.Vector3(x - 6 - Math.random() * 4, ground + 125, z - 5 - Math.random() * 4)
      mesh.position.copy(start)
      this.scene.add(mesh)
      this.projectiles.push({
        kind: 'artillery',
        mesh,
        start,
        end: new THREE.Vector3(x, ground + 0.4, z),
        t: 0,
        duration: 0.48,
        arc: 0,
        trail: true,
        source: strike.source || { team: 'player', dead: false, def: { damage: strike.damage } },
        damage: strike.damage || 180,
        splash: strike.splash || 16,
        crater: strike.crater || 8,
        artillery: true,
      })
      this.sfx.shoot('shell')
    },

    // ── impacts ───────────────────────────────────────────────────────────
    impact(projectile) {
      const point = projectile.end
      if (projectile.kind === 'bullet') {
        const target = projectile.target
        if (target && !target.dead) target.takeDamage(projectile.damage, projectile.source)
        this.sparks.burst(point, {
          count: 4, color: 0xffd58a, speed: 5, up: 1.5, gravity: -9, life: 0.3, size: 0.34, alpha: 0.95,
        })
        return
      }

      const splash = projectile.splash || 0
      const sourceTeam = projectile.source?.team || null
      const x = point.x
      const z = point.z
      const ground = this.terrain.sample(x, z)
      const crater = projectile.crater || 0
      const big = projectile.artillery || projectile.kind === 'bomb' || crater >= 6

      if (crater > 0) {
        this.terrain.deform(x, z, crater, 0.7 + crater * 0.14, 0.65 + crater * 0.03)
        this.stats.craters++
      }

      if (splash > 0) {
        for (const unit of this.units) {
          if (unit.dead || unit.aircraft) continue
          if (sourceTeam && unit.team === sourceTeam) continue
          const radius = entityRadius(unit)
          const distance = Math.hypot(unit.x - x, unit.z - z)
          if (distance > splash + radius) continue
          const falloff = clamp(1 - distance / (splash + radius) * 0.72, 0.24, 1)
          unit.takeDamage(projectile.damage * falloff, projectile.source)
        }
        for (const building of this.buildings) {
          if (building.dead || !building.built) continue
          if (sourceTeam && building.team === sourceTeam) continue
          const distance = Math.hypot(building.x - x, building.z - z)
          if (distance > splash + building.radius) continue
          const falloff = clamp(1 - distance / (splash + building.radius) * 0.6, 0.35, 1)
          building.takeDamage(projectile.damage * falloff, projectile.source)
        }
      } else if (projectile.target && !projectile.target.dead) {
        const target = projectile.target
        const distance = Math.hypot(target.x - x, target.z - z)
        if (distance < 5) target.takeDamage(projectile.damage, projectile.source)
      }

      this.explosion(new THREE.Vector3(x, ground + 0.5, z), big ? 7 + splash * 0.25 : 2.6 + splash * 0.22, big)
      this.sfx.explode(big)
      this.shake = Math.min(2.8, this.shake + (big ? 1.35 : 0.38))
    },

    explosion(position, radius, big = false) {
      const flash = new THREE.Mesh(
        new THREE.SphereGeometry(1, 8, 6),
        new THREE.MeshBasicMaterial({
          color: big ? 0xffb060 : 0xffd18a,
          transparent: true,
          opacity: 0.88,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      )
      flash.position.copy(position)
      flash.scale.setScalar(radius * 0.28)
      this.scene.add(flash)
      this.effects.push({
        obj: flash,
        ttl: big ? 0.62 : 0.34,
        update: (effect, dt) => {
          effect.obj.scale.multiplyScalar(1 + dt * (big ? 5.2 : 6.5))
          effect.obj.material.opacity = Math.max(0, effect.obj.material.opacity - dt * 2.3)
        },
      })
      this.particles.burst(position, {
        count: Math.round(big ? 30 : 12),
        color: 0xffb061,
        speed: radius * (big ? 1.1 : 1.5),
        spread: 0.9,
        up: radius * 0.42,
        gravity: -8,
        life: big ? 1.05 : 0.55,
        size: radius * 0.16,
        sizeVar: 0.8,
        alpha: 0.95,
      })
      this.sparks.burst(position, {
        count: Math.round(big ? 20 : 8),
        color: 0xffe7a6,
        speed: radius * 1.7,
        up: radius * 0.7,
        gravity: -17,
        life: big ? 0.8 : 0.45,
        size: 0.42,
        alpha: 1,
      })
      this.particles.smoke(new THREE.Vector3(position.x, position.y + 0.5, position.z), {
        count: Math.round(big ? 12 : 4),
        color: 0x3d3a33,
        size: big ? 3.1 : 1.5,
        life: big ? 3.4 : 1.8,
        rise: big ? 3.4 : 1.8,
        spread: radius * 0.7,
        alpha: big ? 0.5 : 0.35,
      })
    },

    muzzleFlash(muzzle, size = 0.5, targetX, targetZ) {
      const flash = createMuzzleFlash(0xffd58a)
      flash.position.copy(muzzle)
      flash.scale.setScalar(size)
      this.scene.add(flash)
      this.effects.push({
        obj: flash,
        ttl: 0.075,
        update: (effect, dt) => {
          effect.obj.scale.multiplyScalar(1 + dt * 15)
          effect.obj.material.opacity = Math.max(0, effect.obj.material.opacity - dt * 9)
        },
      })
      const dx = targetX - muzzle.x
      const dz = targetZ - muzzle.z
      const length = Math.hypot(dx, dz) || 1
      this.sparks.burst(muzzle, {
        count: 2,
        color: 0xffd58a,
        speed: 9,
        spread: 0.25,
        up: 1.4,
        gravity: -8,
        life: 0.16,
        size: 0.26,
        direction: { x: dx / length, y: 0.12, z: dz / length },
      })
    },

    smokePuff(position, scale = 1) {
      this.particles.smoke(position, {
        count: 1,
        color: scale > 0.45 ? 0x4a4740 : 0x8b8779,
        size: (scale > 0.45 ? 2.1 : 1.1) * (0.8 + Math.random() * 0.5),
        life: 0.9 + Math.random() * 0.7,
        rise: 0.8 + Math.random() * 0.8,
        spread: 0.4,
        alpha: 0.26,
      })
    },

    // ── death & wreckage ─────────────────────────────────────────────────
    destroyUnit(unit, source) {
      if (!unit || unit.dead) return
      unit.dead = true
      unit.hp = 0
      const position = unit.model.position.clone()
      if (unit.ring) unit.ring.visible = false

      this.selection = this.selection.filter(entity => entity !== unit)
      this.scene.remove(unit.model)
      if (unit.aircraft && unit.ring) {
        this.scene.remove(unit.ring)
        unit.ring.geometry?.dispose()
        unit.ring.material?.dispose()
      }

      if (source?.team === 'player' && unit.team === 'enemy') this.stats.kills++

      const category = unit.def.category
      const blastRadius = category === 'soldier' ? 2.2 : category === 'plane' ? 7 : 4.2
      const blast = new THREE.Vector3(unit.x, Math.max(unit.model.position.y, this.terrain.sample(unit.x, unit.z) + 0.5), unit.z)
      this.explosion(blast, blastRadius, category === 'plane' || category === 'tank')
      this.sfx.explode(category !== 'soldier')

      const wreck = createWreck(unit)
      const wreckY = this.terrain.sample(unit.x, unit.z) + (unit.aircraft ? 0.4 : 0.02)
      wreck.position.set(unit.x, wreckY, unit.z)
      wreck.rotation.copy(unit.model.rotation)
      if (unit.aircraft) {
        wreck.rotation.z = (Math.random() - 0.5) * 0.8
        wreck.rotation.x = 0.22
      }
      wreck.traverse(o => { if (o.isMesh) o.castShadow = true })
      this.scene.add(wreck)
      this.wrecks.push({ obj: wreck, ttl: category === 'soldier' ? 16 : 28, smoke: 0.4 })

      if (unit.team === 'player' && (category === 'tank' || category === 'plane')) {
        this.ui?.toast(`${unit.def.name.toUpperCase()} DESTROYED`, 'warn')
      }
      if (this.hoverEntity === unit) this.hoverEntity = null
      this.ui?.updateSelection()
    },

    destroyBuilding(building, source) {
      if (!building || building.dead) return
      building.dead = true
      building.hp = 0
      if (building.ring) building.ring.visible = false
      const wasHq = building.def.key === 'hq'
      const position = building.model.position.clone()
      this.selection = this.selection.filter(entity => entity !== building)
      this.scene.remove(building.model)
      building.dispose()

      const blast = new THREE.Vector3(building.x, position.y + 2.6, building.z)
      this.explosion(blast, wasHq ? 16 : Math.max(4, building.def.size * 0.55), wasHq || building.def.size >= 10)
      this.sfx.explode(true)

      const wreck = createWreck(building)
      wreck.position.copy(position)
      wreck.rotation.copy(building.model.rotation)
      this.scene.add(wreck)
      this.wrecks.push({ obj: wreck, ttl: wasHq ? 60 : 40, smoke: 0.3 })

      if (building.team === 'player') {
        this.ui?.toast(`${building.def.name.toUpperCase()} DESTROYED`, 'warn')
      } else if (wasHq) {
        this.ui?.toast('ENEMY HEADQUARTERS DESTROYED', 'good')
      }
      if (this.hoverEntity === building) this.hoverEntity = null
      this.ui?.updateSelection()
      if (wasHq) this.checkVictory()
    },
  })
}

export { _center, _pos }
