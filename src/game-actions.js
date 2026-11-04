import * as THREE from 'three'
import { createBuildingModel, createGroundMarker } from './models.js'
import { Building, Unit } from './entities.js'
import { GAME_RULES } from './data.js'
import { HALF } from './terrain.js'
import { clamp } from './util.js'

function disposeObject(obj) {
  if (!obj) return
  obj.traverse?.(child => {
    if (child.isMesh || child.isLine || child.isPoints) {
      child.geometry?.dispose()
      if (Array.isArray(child.material)) child.material.forEach(material => material.dispose())
      else child.material?.dispose()
    }
  })
  obj.parent?.remove(obj)
}

export function installActions(proto) {
  Object.assign(proto, {
    // ── spawning ─────────────────────────────────────────────────────────
    spawnUnit(def, team, x, z) {
      if (!def) return null
      const unit = new Unit(this, def, team, x, z)
      this.units.push(unit)
      return unit
    },

    spawnBuilding(def, team, x, z, built = true) {
      if (!def) return null
      const building = new Building(this, def, team, x, z, built)
      this.buildings.push(building)
      return building
    },

    findSpawnSpot(x, z, radius = 2.4, team = 'player') {
      const flying = radius >= 5
      const blocked = (px, pz) => {
        if (Math.abs(px) > HALF - 12 || Math.abs(pz) > HALF - 12) return true
        if (!flying && this.map.water && this.terrain.sample(px, pz) < 0.45) return true
        if (flying) return false
        for (const building of this.buildings) {
          if (building.dead) continue
          if (Math.hypot(px - building.x, pz - building.z) < building.radius + radius + 0.8) return true
        }
        for (const unit of this.units) {
          if (unit.dead || unit.aircraft) continue
          if (Math.hypot(px - unit.x, pz - unit.z) < unit.radius + radius * 0.8 + 0.4) return true
        }
        return false
      }
      const baseRadius = Math.max(radius + 2.5, 5)
      for (let ring = 0; ring < 14; ring++) {
        const distance = baseRadius + ring * 2.6
        const steps = 10 + ring * 2
        for (let i = 0; i < steps; i++) {
          const angle = (i / steps) * Math.PI * 2 + ring * 0.63 + (team === 'enemy' ? Math.PI : 0)
          const px = clamp(x + Math.cos(angle) * distance, -HALF + 14, HALF - 14)
          const pz = clamp(z + Math.sin(angle) * distance, -HALF + 14, HALF - 14)
          if (!blocked(px, pz)) return { x: px, z: pz }
        }
      }
      return { x: clamp(x, -HALF + 14, HALF - 14), z: clamp(z, -HALF + 14, HALF - 14) }
    },

    // ── production ───────────────────────────────────────────────────────
    productionForCategory(category) {
      let best = null
      for (const building of this.buildings) {
        if (building.dead || !building.built || building.team !== 'player') continue
        if (!building.def.produces.includes(category)) continue
        if (!best || building.queue.length < best.queue.length) best = building
      }
      return best
    },

    queuedCount(unitId) {
      let count = 0
      for (const building of this.buildings) {
        if (building.dead || building.team !== 'player') continue
        for (const item of building.queue) if (item.def.id === unitId) count++
      }
      return count
    },

    queueForTeam(unit, building, team) {
      if (!unit || !building || building.dead) return false
      if (!building.built || !building.def.produces.includes(unit.category)) {
        if (team === 'player') {
          this.ui?.toast(`REQUIRES ${this.producerName(unit.category).toUpperCase()}`, 'warn')
          this.sfx.deny()
        }
        return false
      }
      if (building.queue.length >= 5) {
        if (team === 'player') this.ui?.toast('PRODUCTION QUEUE FULL', 'warn')
        return false
      }
      const bank = team === 'player' ? this.supplies : this.enemySupplies
      if (bank < unit.cost) {
        if (team === 'player') {
          this.ui?.toast('INSUFFICIENT SUPPLY', 'warn')
          this.sfx.deny()
        }
        return false
      }
      const pop = this.popFor(team)
      if (pop.used + unit.pop > pop.cap) {
        if (team === 'player') {
          this.ui?.toast('POPULATION CAP REACHED · BUILD SUPPLY DEPOTS', 'warn')
          this.sfx.deny()
        }
        return false
      }
      if (!building.queueUnit(unit)) return false
      if (team === 'player') {
        this.supplies -= unit.cost
        this.sfx.click()
      } else {
        this.enemySupplies -= unit.cost
      }
      this.recalculateEconomy()
      return true
    },

    producerName(category) {
      return category === 'soldier' ? 'Barracks' : category === 'plane' ? 'Airfield' : 'Factory'
    },

    queueUnit(unit) {
      if (!unit) return false
      const building = this.productionForCategory(unit.category)
      if (!building) {
        this.ui?.toast(`REQUIRES ${this.producerName(unit.category).toUpperCase()}`, 'warn')
        this.sfx.deny()
        return false
      }
      return this.queueForTeam(unit, building, 'player')
    },

    // ── placement ────────────────────────────────────────────────────────
    isPlacementValid(def, x, z, team = 'player') {
      if (!def) return false
      if (!this.terrain.canBuild(x, z, def.size)) return false
      if (Math.abs(x) > HALF - 14 || Math.abs(z) > HALF - 14) return false
      for (const building of this.buildings) {
        if (building.dead) continue
        const spacing = (def.size + building.def.size) * 0.55 + 1.4
        if (Math.hypot(x - building.x, z - building.z) < spacing) return false
      }
      for (const capture of this.capturePoints) {
        if (Math.hypot(x - capture.x, z - capture.z) < GAME_RULES.captureRadius * 0.55 + def.size * 0.35) return false
      }
      return true
    },

    beginPlacement(key) {
      if (this.gameOver) return
      const def = this.buildingsByKey[key]
      if (!def) return
      if (this.supplies < def.cost) {
        this.ui?.toast('INSUFFICIENT SUPPLY', 'warn')
        this.sfx.deny()
        return
      }
      this.cancelModes()
      this.mode = 'placement'
      this.placement = { def, x: 0, z: 0, valid: false }
      const ghost = createBuildingModel(def, this.playerFaction)
      ghost.traverse(child => {
        if (!child.isMesh) return
        child.material = Array.isArray(child.material)
          ? child.material.map(material => material.clone())
          : child.material.clone()
        const materials = Array.isArray(child.material) ? child.material : [child.material]
        materials.forEach(material => {
          material.transparent = true
          material.opacity = 0.46
          material.depthWrite = false
        })
        child.castShadow = false
        child.receiveShadow = false
      })
      ghost.visible = false
      this.scene.add(ghost)
      this.ghost = ghost
      const ring = createGroundMarker(def.size * 0.62, 0x7ad9c5)
      ring.visible = false
      this.scene.add(ring)
      this.ghostRing = ring
      this.renderer.domElement.classList.add('placing')
      this.ui?.setPlacement(`PLACE ${def.name.toUpperCase()} · ${def.cost} SUPPLY`, true)
      this.ui?.setLock(null)
      this.updateGhostVisual()
    },

    updateGhostVisual() {
      if (this.artilleryPreview && this.mode === 'artillery') this.updateArtilleryPreview()
      if (!this.ghost || this.mode !== 'placement' || !this.placement) return
      const point = this.terrainPoint()
      if (!point) {
        this.ghost.visible = false
        if (this.ghostRing) this.ghostRing.visible = false
        return
      }
      const { def } = this.placement
      const valid = this.isPlacementValid(def, point.x, point.z, 'player')
      this.placement.x = point.x
      this.placement.z = point.z
      this.placement.valid = valid
      const y = this.terrain.sample(point.x, point.z)
      this.ghost.visible = true
      this.ghost.position.set(point.x, y, point.z)
      this.ghost.rotation.y = Math.atan2(-point.x, -point.z)
      if (this.ghostRing) {
        this.ghostRing.visible = true
        this.ghostRing.position.set(point.x, y + 0.18, point.z)
        this.ghostRing.material.color.setHex(valid ? 0x7ad9c5 : 0xe0705a)
        this.ghostRing.material.opacity = 0.55 + Math.sin(this.elapsed * 4) * 0.18
      }
      this.ui?.setPlacement(
        valid
          ? `PLACE ${def.name.toUpperCase()} · ${def.cost} SUPPLY`
          : 'INVALID SITE · MOVE TO FLAT GROUND',
        valid,
      )
    },

    placeBuilding() {
      if (!this.placement) return false
      const { def, valid, x, z } = this.placement
      if (!valid) {
        this.ui?.toast('INVALID BUILD SITE', 'warn')
        this.sfx.deny()
        return false
      }
      if (this.supplies < def.cost) {
        this.ui?.toast('INSUFFICIENT SUPPLY', 'warn')
        this.sfx.deny()
        this.cancelModes()
        return false
      }
      this.supplies -= def.cost
      this.recalculateEconomy()
      this.spawnBuilding(def, 'player', x, z, false)
      this.ui?.toast(`${def.name.toUpperCase()} UNDER CONSTRUCTION`, 'good')
      this.sfx.build()
      this.cancelModes()
      return true
    },

    cancelPlacement() {
      this.cancelModes()
    },

    cancelModes() {
      this.mode = null
      this.placement = null
      this.rallyBuilding = null
      this.targetingArtillery = false
      if (this.ghost) {
        disposeObject(this.ghost)
        this.ghost = null
      }
      if (this.ghostRing) {
        disposeObject(this.ghostRing)
        this.ghostRing = null
      }
      if (this.artilleryPreview) {
        disposeObject(this.artilleryPreview.group)
        this.artilleryPreview = null
      }
      this.renderer?.domElement?.classList.remove('placing')
      this.ui?.setPlacement(null)
    },

    updateArtilleryPreview() {
      if (!this.artilleryPreview) return
      const point = this.terrainPoint()
      if (!point) {
        this.artilleryPreview.group.visible = false
        return
      }
      this.artilleryPreview.group.visible = true
      this.artilleryPreview.group.position.set(point.x, this.terrain.sample(point.x, point.z) + 0.16, point.z)
      const preview = this.artilleryPreview
      preview.ring.material.opacity = 0.55 + Math.sin(this.elapsed * 4.5) * 0.2
      preview.disc.material.opacity = 0.06 + (Math.sin(this.elapsed * 3.2) * 0.5 + 0.5) * 0.04
    },

    // ── orders & abilities ───────────────────────────────────────────────
    beginRally() {
      const buildings = this.selection.filter(entity => entity.kind === 'building' && entity.team === 'player' && entity.built)
      if (!buildings.length) {
        this.ui?.toast('SELECT A PRODUCTION STRUCTURE', 'warn')
        this.sfx.deny()
        return
      }
      this.cancelModes()
      this.mode = 'rally'
      this.rallyBuilding = buildings[0]
      this.ui?.setPlacement('RALLY POINT · CLICK DESTINATION')
      this.renderer.domElement.classList.add('placing')
    },

    setRally(x, z) {
      const building = this.rallyBuilding
      if (!building || building.dead) return
      building.rally.set(clamp(x, -HALF + 12, HALF - 12), 0, clamp(z, -HALF + 12, HALF - 12))
      this.orderMarker(x, z, '#d3b77b')
      this.ui?.toast(`RALLY POINT SET · ${building.def.name.toUpperCase()}`)
      this.sfx.order()
    },

    beginAttackMove() {
      if (!this.selectedPlayerUnits.length) {
        this.ui?.toast('SELECT UNITS FIRST', 'warn')
        this.sfx.deny()
        return
      }
      this.cancelModes()
      this.mode = 'attackMove'
      this.ui?.setPlacement('ATTACK-MOVE · CLICK TARGET GROUND')
      this.renderer.domElement.classList.add('placing')
    },

    beginArtillery() {
      if (this.gameOver) return
      if (this.artilleryCooldown > 0) {
        this.ui?.toast(`BARRAGE RECHARGING · ${Math.ceil(this.artilleryCooldown)}s`, 'warn')
        this.sfx.deny()
        return
      }
      if (this.mode === 'artillery') {
        this.cancelModes()
        return
      }
      this.cancelModes()
      this.mode = 'artillery'
      this.targetingArtillery = true
      const group = new THREE.Group()
      const ring = createGroundMarker(GAME_RULES.artilleryRadius, 0xe0705a)
      ring.material.opacity = 0.65
      group.add(ring)
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(GAME_RULES.artilleryRadius, 40),
        new THREE.MeshBasicMaterial({ color: 0xe0705a, transparent: true, opacity: 0.075, depthWrite: false, side: THREE.DoubleSide }),
      )
      disc.rotation.x = -Math.PI / 2
      disc.position.y = 0.05
      disc.raycast = () => {}
      group.add(disc)
      group.visible = false
      this.scene.add(group)
      this.artilleryPreview = { group, ring, disc }
      this.renderer.domElement.classList.add('placing')
      this.ui?.setPlacement('BARRAGE · CLICK TARGET AREA')
      this.updateArtilleryPreview()
    },

    callArtillery(x, z) {
      if (this.artilleryCooldown > 0) return false
      const tx = clamp(x, -HALF + 12, HALF - 12)
      const tz = clamp(z, -HALF + 12, HALF - 12)
      this.artilleryCooldown = GAME_RULES.artilleryCooldown
      const source = { team: 'player', dead: false, def: { damage: 180 } }
      const shells = GAME_RULES.artilleryShells
      for (let i = 0; i < shells; i++) {
        const angle = Math.random() * Math.PI * 2
        const distance = Math.sqrt(Math.random()) * GAME_RULES.artilleryRadius * 0.82
        this.strikes.push({
          t: 0.45 + i * 0.34 + Math.random() * 0.22,
          x: tx + Math.cos(angle) * distance,
          z: tz + Math.sin(angle) * distance,
          damage: 165 + Math.random() * 70,
          splash: 14,
          crater: 7.2 + Math.random() * 2.4,
          source,
        })
      }
      this.orderMarker(tx, tz, '#e0705a', GAME_RULES.artilleryRadius * 0.55)
      this.sfx.artillery()
      this.ui?.toast('BARRAGE INBOUND · DANGER CLOSE', 'warn')
      this.shake = Math.min(2.2, this.shake + 0.5)
      this.targetingArtillery = false
      this.cancelModes()
      return true
    },

    orderMarker(x, z, color = '#7ad9c5', radius = 2.1) {
      const marker = createGroundMarker(radius, new THREE.Color(color).getHex())
      marker.position.set(x, this.terrain.sample(x, z) + 0.22, z)
      this.scene.add(marker)
      this.effects.push({
        obj: marker,
        ttl: 0.85,
        update: (effect, dt) => {
          effect.obj.scale.multiplyScalar(1 + dt * 1.6)
          effect.obj.material.opacity = Math.max(0, effect.obj.material.opacity - dt * 1.4)
        },
      })
      this.lastMoveMark = this.elapsed
    },

    stopSelected() {
      const units = this.selectedPlayerUnits
      if (!units.length) return
      for (const unit of units) unit.stop()
    },

    holdSelected() {
      const units = this.selectedPlayerUnits
      if (!units.length) return
      for (const unit of units) unit.hold()
    },

    returnToBase() {
      const units = this.selectedPlayerUnits
      if (!units.length) return
      for (const unit of units) unit.returnToBase()
      this.sfx.order()
    },

    orderRepair() {
      const engineers = this.selectedPlayerUnits.filter(unit => unit.def.repair)
      if (!engineers.length) {
        this.ui?.toast('SELECT AN ENGINEER', 'warn')
        this.sfx.deny()
        return
      }
      let ordered = false
      for (const engineer of engineers) {
        let best = null
        let bestDistance = 90
        for (const target of [...this.playerUnits, ...this.playerBuildings]) {
          if (target === engineer || target.dead) continue
          if (target.hp >= target.maxHp - 1) continue
          if (target.kind === 'unit' && target.aircraft) continue
          const distance = Math.hypot(target.x - engineer.x, target.z - engineer.z)
          if (distance < bestDistance) {
            best = target
            bestDistance = distance
          }
        }
        if (best) {
          engineer.repair(best)
          ordered = true
        }
      }
      if (!ordered) {
        this.ui?.toast('NO DAMAGED STRUCTURE OR VEHICLE IN RANGE', 'warn')
        this.sfx.deny()
      } else {
        this.sfx.order()
      }
    },

    // ── camera & app ─────────────────────────────────────────────────────
    setCameraTarget(x, z) {
      const tx = clamp(x, -HALF + 18, HALF - 18)
      const tz = clamp(z, -HALF + 18, HALF - 18)
      this.cameraGoal.set(tx, this.terrain.sample(tx, tz) + 2, tz)
    },

    focusBase() {
      this.setCameraTarget(this.playerBase.x, this.playerBase.z)
    },

    focusEnemy() {
      this.setCameraTarget(this.enemyBase.x, this.enemyBase.z)
    },

    focusSelection() {
      const targets = this.selection.filter(entity => !entity.dead)
      if (!targets.length) {
        this.focusBase()
        return
      }
      let x = 0, z = 0
      for (const entity of targets) {
        x += entity.x
        z += entity.z
      }
      this.setCameraTarget(x / targets.length, z / targets.length)
    },

    selectAllArmy() {
      this.clearSelection()
      for (const unit of this.playerUnits) {
        if (unit.dead) continue
        unit.setSelected(true)
        this.selection.push(unit)
      }
      this.ui?.updateSelection()
      if (this.selection.length) this.sfx.select()
    },

    requestMenu() {
      this.app?.returnToMenu?.()
    },

    restart() {
      this.app?.restartGame?.(this.options)
    },
  })
}
