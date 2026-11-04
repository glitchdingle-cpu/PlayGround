import * as THREE from 'three'
import { CAPTURE_POSITIONS, GAME_RULES } from './data.js'
import { createGroundMarker } from './models.js'
import { clamp } from './util.js'
import { UNIT_MATERIAL, WRECK_MATERIAL } from './models.js'

function letterTexture(letter) {
  const c = document.createElement('canvas')
  c.width = 128; c.height = 128
  const ctx = c.getContext('2d')
  ctx.clearRect(0, 0, 128, 128)
  ctx.strokeStyle = 'rgba(0,0,0,0.55)'
  ctx.lineWidth = 8
  ctx.beginPath()
  ctx.arc(64, 64, 50, 0, Math.PI * 2)
  ctx.stroke()
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 66px "Arial Narrow", Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(letter, 64, 68)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export function installCore(proto) {
  Object.assign(proto, {
    setupLights() {
      const map = this.map
      this.renderer.shadowMap.enabled = true
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping
      this.renderer.toneMappingExposure = 1.02
      let gpuName = ''
      try {
        const gl = this.renderer.getContext()
        const ext = gl.getExtension('WEBGL_debug_renderer_info')
        gpuName = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : ''
      } catch {}
      this.softwareRenderer = /swiftshader|llvmpipe|software/i.test(gpuName)
      const hemi = new THREE.HemisphereLight(map.palette.sky, map.palette.low, 1.75)
      this.scene.add(hemi)
      const sun = new THREE.DirectionalLight(map.palette.sun, 2.65)
      sun.position.set(-95, 150, 70)
      sun.castShadow = true
      sun.shadow.mapSize.set(this.softwareRenderer ? 1024 : 2048, this.softwareRenderer ? 1024 : 2048)
      sun.shadow.camera.left = -90
      sun.shadow.camera.right = 90
      sun.shadow.camera.top = 90
      sun.shadow.camera.bottom = -90
      sun.shadow.camera.near = 5
      sun.shadow.camera.far = 420
      sun.shadow.bias = -0.0006
      sun.shadow.normalBias = 0.6
      this.scene.add(sun)
      this.sun = sun
      this.sunTarget = new THREE.Object3D()
      this.scene.add(this.sunTarget)
      sun.target = this.sunTarget
      const fill = new THREE.DirectionalLight(0x9cb8bd, 0.38)
      fill.position.set(130, 70, -120)
      this.scene.add(fill)
      this.hemi = hemi
    },

    setupCamera() {
      const tx = this.playerBase.x + 30
      const tz = this.playerBase.z - 30
      this.cameraTarget.set(tx, this.terrain.sample(tx, tz) + 2, tz)
      this.cameraGoal.copy(this.cameraTarget)
      this.cameraDistance = 112
      this.cameraZoomGoal = 112
      this.camera.aspect = this.viewW / this.viewH
      this.camera.updateProjectionMatrix()
    },

    createCapturePoints() {
      const letters = ['A', 'B', 'C']
      this.capturePoints = CAPTURE_POSITIONS.map((p, i) => {
        const group = new THREE.Group()
        const y = this.terrain.sample(p.x, p.z)
        group.position.set(p.x, y, p.z)
        const ring = createGroundMarker(GAME_RULES.captureRadius, 0xd3b77b)
        ring.material.opacity = 0.42
        group.add(ring)
        const disc = new THREE.Mesh(
          new THREE.CircleGeometry(GAME_RULES.captureRadius, 32),
          new THREE.MeshBasicMaterial({ color: 0xd3b77b, transparent: true, opacity: 0.045, depthWrite: false, side: THREE.DoubleSide }),
        )
        disc.rotation.x = -Math.PI / 2
        disc.position.y = 0.05
        disc.raycast = () => {}
        group.add(disc)
        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.12, 0.16, 9, 6),
          new THREE.MeshStandardMaterial({ color: 0x3d3f37, roughness: 0.8, metalness: 0.3 }),
        )
        pole.position.y = 4.5
        pole.castShadow = true
        group.add(pole)
        const flagMat = new THREE.MeshStandardMaterial({ color: 0xd3b77b, side: THREE.DoubleSide, roughness: 0.9 })
        const pivot = new THREE.Object3D()
        pivot.position.y = 8.6
        const flag = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.5), flagMat)
        flag.position.set(2.1, 0, 0)
        flag.castShadow = true
        pivot.add(flag)
        group.add(pivot)
        const spriteMat = new THREE.SpriteMaterial({ map: letterTexture(letters[i]), color: 0xd3b77b, transparent: true, depthTest: false })
        const sprite = new THREE.Sprite(spriteMat)
        sprite.position.y = 13
        sprite.scale.set(3.4, 3.4, 1)
        group.add(sprite)
        // supply crates
        const crateMat = new THREE.MeshStandardMaterial({ color: 0x6e6044, roughness: 0.95 })
        const crateGeo = new THREE.BoxGeometry(1.6, 1.1, 1.3)
        for (let k = 0; k < 4; k++) {
          const crate = new THREE.Mesh(crateGeo, crateMat)
          crate.position.set(Math.cos(k * 1.7) * 4.5, 0.55, Math.sin(k * 1.7) * 4.5)
          crate.rotation.y = k * 1.1
          crate.castShadow = true
          group.add(crate)
        }
        this.scene.add(group)
        return {
          x: p.x, z: p.z, letter: letters[i], owner: null, progress: 0, capturingTeam: null, contested: false,
          group, flagMat, pivot, ringMat: ring.material, spriteMat, discMat: disc.material,
        }
      })
    },

    setupBases() {
      const findUnit = (roster, category, key) => roster.find(u => u.category === category && u.key === key)
      const build = (team, key, x, z, built = true) => {
        const def = this.buildingsByKey[key]
        if (def) this.spawnBuilding(def, team, x, z, built)
      }
      const b = { px: this.playerBase.x, pz: this.playerBase.z, ex: this.enemyBase.x, ez: this.enemyBase.z }
      build('player', 'hq', b.px, b.pz)
      build('player', 'barracks', b.px + 21, b.pz + 15)
      build('player', 'factory', b.px - 20, b.pz - 15)
      build('player', 'depot', b.px - 20, b.pz + 17)
      build('enemy', 'hq', b.ex, b.ez)
      build('enemy', 'barracks', b.ex - 21, b.ez - 15)
      build('enemy', 'factory', b.ex + 20, b.ez + 15)
      build('enemy', 'depot', b.ex + 20, b.ez - 17)
      build('enemy', 'turret', b.ex - 16, b.ez + 14)

      const p = this.playerRoster
      const e = this.enemyRoster
      const playerStart = [
        [findUnit(p, 'soldier', 'rifleman'), -10, -8],
        [findUnit(p, 'soldier', 'assault'), -4, -2],
        [findUnit(p, 'soldier', 'gunner'), -14, -14],
        [findUnit(p, 'soldier', 'marksman'), -7, -16],
        [findUnit(p, 'soldier', 'engineer'), -2, -12],
        [findUnit(p, 'tank', 'light'), 12, -6],
        [findUnit(p, 'tank', 'medium'), 5, 8],
        [findUnit(p, 'vehicle', 'recon'), -15, 4],
      ]
      for (const [def, dx, dz] of playerStart) if (def) this.spawnUnit(def, 'player', b.px + dx, b.pz + dz)
      const enemyStart = [
        [findUnit(e, 'soldier', 'rifleman'), 10, 8],
        [findUnit(e, 'soldier', 'assault'), 5, 12],
        [findUnit(e, 'soldier', 'gunner'), 14, 14],
        [findUnit(e, 'soldier', 'marksman'), 7, 17],
        [findUnit(e, 'tank', 'light'), -12, 6],
        [findUnit(e, 'tank', 'medium'), -4, -8],
      ]
      for (const [def, dx, dz] of enemyStart) if (def) this.spawnUnit(def, 'enemy', b.ex + dx, b.ez + dz)
      this.recalculateEconomy()
    },

    updateEconomy(dt) {
      this.econTick -= dt
      if (this.econTick <= 0) {
        this.econTick = 0.25
        this.recalculateEconomy()
      }
      if (!this.gameOver) {
        this.supplies = Math.min(99999, this.supplies + this.income * dt)
        this.enemySupplies = Math.min(99999, this.enemySupplies + this.enemyIncome * dt)
      }
    },

    recalculateEconomy() {
      const ownedCaps = this.capturePoints.filter(c => c.owner === 'player').length
      const enemyCaps = this.capturePoints.filter(c => c.owner === 'enemy').length
      let pDepot = 0, eDepot = 0, pPop = 0, ePop = 0
      for (const b of this.buildings) {
        if (b.dead || !b.built) continue
        if (b.team === 'player') {
          if (b.def.income) pDepot += b.def.income
          if (b.def.popCap) pPop += b.def.popCap
        } else {
          if (b.def.income) eDepot += b.def.income
          if (b.def.popCap) ePop += b.def.popCap
        }
      }
      this.income = GAME_RULES.baseIncome + pDepot + ownedCaps * GAME_RULES.captureIncome
      this.enemyIncome = GAME_RULES.baseIncome + eDepot + enemyCaps * GAME_RULES.captureIncome
      this.popCap = Math.min(GAME_RULES.maxPopCap, GAME_RULES.startPopCap + pPop)
      this.enemyPopCap = Math.min(GAME_RULES.maxPopCap, GAME_RULES.startPopCap + ePop)
      const pop = this.popFor('player')
      this.usedPop = pop.used
      this.queuedPop = pop.queued
    },

    popFor(team) {
      let current = 0, queued = 0
      for (const u of this.units) if (u.team === team && !u.dead) current += u.def.pop
      for (const b of this.buildings) {
        if (b.team !== team || b.dead || !b.built) continue
        for (const q of b.queue) queued += q.def.pop
      }
      return {
        used: current + queued,
        current,
        queued,
        cap: team === 'player' ? this.popCap : (this.enemyPopCap || this.popCap),
      }
    },

    updateCapturePoints(dt) {
      for (const c of this.capturePoints) {
        let p = 0, e = 0
        for (const u of this.units) {
          if (u.dead || u.aircraft) continue
          if (Math.hypot(u.x - c.x, u.z - c.z) > GAME_RULES.captureRadius) continue
          if (u.team === 'player') p++
          else e++
        }
        c.contested = p > 0 && e > 0
        const team = p > 0 && e === 0 ? 'player' : e > 0 && p === 0 ? 'enemy' : null
        if (team && c.owner !== team) {
          if (c.capturingTeam !== team) { c.capturingTeam = team; c.progress = 0 }
          c.progress = Math.min(1, c.progress + dt / GAME_RULES.captureTime)
          if (c.progress >= 1) {
            c.owner = team
            c.progress = 0
            c.capturingTeam = null
            this.applyCaptureVisual(c, team)
            this.recalculateEconomy()
            if (team === 'player') this.ui?.toast(`SECTOR ${c.letter} SECURED · +${GAME_RULES.captureIncome} SUPPLY/S`, 'good')
            else this.ui?.toast(`SECTOR ${c.letter} LOST TO ENEMY`, 'warn')
            this.sfx.ready()
          }
        } else if (!team) {
          if (!c.contested) {
            c.progress = Math.max(0, c.progress - dt * 0.12)
            if (c.progress === 0) c.capturingTeam = null
          }
        } else if (team === c.owner) {
          c.progress = 0
          c.capturingTeam = null
        }
        const pulse = 0.3 + Math.sin(this.elapsed * 2.2 + c.x * 0.1) * 0.08 + (c.contested ? 0.2 : 0)
        c.ringMat.opacity = pulse
        c.discMat.opacity = 0.035 + (c.contested ? 0.04 : 0.01)
        c.pivot.rotation.y = Math.sin(this.elapsed * 1.8 + c.z) * 0.12
      }
    },

    applyCaptureVisual(c, team) {
      const faction = team === 'player' ? this.playerFaction : team === 'enemy' ? this.enemyFaction : null
      const color = team === 'player' ? new THREE.Color(this.playerFaction.colors.accent) : team === 'enemy' ? new THREE.Color(this.enemyFaction.colors.accent) : new THREE.Color(0xd3b77b)
      c.flagMat.color.copy(color)
      c.ringMat.color.copy(color)
      c.spriteMat.color.copy(color)
      c.discMat.color.copy(color)
    },

    update(dt) {
      dt = Math.min(dt, 0.05)
      if (!this.gameOver) this.elapsed += dt
      this.updateCamera(dt)
      this.updateEconomy(dt)
      if (!this.gameOver) {
        this.updateUnits(dt)
        this.updateBuildings(dt)
        this.updateAI(dt)
        this.updateCapturePoints(dt)
        this.checkVictory()
      }
      this.updateProjectiles(dt)
      this.updateStrikes(dt)
      this.updateEffects(dt)
      this.updateWrecks(dt)
      this.particles.update(dt)
      this.sparks.update(dt)
      this.weather.update(dt, this.cameraTarget, this.camera)
      this.terrain.update(dt, this.elapsed)
      this.artilleryCooldown = Math.max(0, this.artilleryCooldown - dt)
      this.baseAlert = Math.max(0, this.baseAlert - dt)
      this.updateSelectionVisual()
      this.updateGhostVisual()
      this.ui.update()
      this.drawOverlay(dt)
      if (this.gameOver) {
        this.endTimer += dt
        if (!this.endShown && this.endTimer > 1.25) {
          this.endShown = true
          this.selection = []
          this.ui.showEnd(this.endVictory, this.stats)
          if (this.endVictory) this.sfx.victory()
          else this.sfx.defeat()
        }
      }
    },

    updateUnits(dt) {
      this.gridTick -= dt
      if (this.gridTick <= 0) {
        this.gridTick = 0.22
        this.spatialGrid.clear()
        for (const u of this.units) {
          if (u.dead || u.aircraft) continue
          const key = `${Math.floor(u.x / 18)},${Math.floor(u.z / 18)}`
          let cell = this.spatialGrid.get(key)
          if (!cell) { cell = []; this.spatialGrid.set(key, cell) }
          cell.push(u)
        }
      }
      const copy = this.units.slice()
      for (const u of copy) if (!u.dead) u.update(dt, this.elapsed)
      this.separateUnits()
    },

    separateUnits() {
      for (const u of this.units) {
        if (u.dead || u.aircraft) continue
        const cx = Math.floor(u.x / 18), cz = Math.floor(u.z / 18)
        for (let ix = cx - 1; ix <= cx + 1; ix++) {
          for (let iz = cz - 1; iz <= cz + 1; iz++) {
            const cell = this.spatialGrid.get(`${ix},${iz}`)
            if (!cell) continue
            for (const o of cell) {
              if (o === u || o.dead) continue
              const dx = u.x - o.x, dz = u.z - o.z
              const d = Math.hypot(dx, dz)
              const minD = (u.radius + o.radius) * 0.48
              if (d > 0.001 && d < minD) {
                const push = (minD - d) * 0.5
                u.model.position.x += dx / d * push
                u.model.position.z += dz / d * push
              }
            }
          }
        }
        for (const b of this.buildings) {
          if (b.dead) continue
          const dx = u.x - b.x, dz = u.z - b.z
          const d = Math.hypot(dx, dz)
          const minD = b.radius + u.radius * 0.45
          if (d > 0.001 && d < minD) {
            const push = (minD - d) * 0.7
            u.model.position.x += dx / d * push
            u.model.position.z += dz / d * push
          }
        }
        u.model.position.x = clamp(u.model.position.x, -212, 212)
        u.model.position.z = clamp(u.model.position.z, -212, 212)
        if (!u.aircraft) u.model.position.y = this.terrain.sample(u.x, u.z)
      }
    },

    updateBuildings(dt) {
      for (const b of this.buildings.slice()) if (!b.dead) b.update(dt, this.elapsed)
      this.buildings = this.buildings.filter(b => !b.dead)
      this.units = this.units.filter(u => !u.dead)
    },

    updateSelectionVisual() {
      let changed = false
      for (const e of this.selection) {
        if (e.dead) { changed = true; continue }
        if (e.ring) e.ring.visible = true
      }
      if (changed) {
        this.selection = this.selection.filter(e => !e.dead)
        this.ui.updateSelection()
      }
    },

    onTerrainDeform(x, z, radius) {
      for (const u of this.units) {
        if (u.dead || u.aircraft) continue
        if (Math.hypot(u.x - x, u.z - z) < radius * 2) {
          u.model.position.y = this.terrain.sample(u.x, u.z)
        }
      }
      for (const w of this.wrecks) {
        if (Math.hypot(w.obj.position.x - x, w.obj.position.z - z) < radius * 2) {
          w.obj.position.y = this.terrain.sample(w.obj.position.x, w.obj.position.z)
        }
      }
    },

    updateProjectiles(dt) {
      for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const p = this.projectiles[i]
        p.t += dt / p.duration
        if (p.t >= 1) {
          this.projectiles.splice(i, 1)
          this.scene.remove(p.mesh)
          p.mesh.geometry?.dispose()
          p.mesh.material?.dispose()
          this.impact(p)
          continue
        }
        const t = p.t
        const x = p.start.x + (p.end.x - p.start.x) * t
        const z = p.start.z + (p.end.z - p.start.z) * t
        const y = p.start.y + (p.end.y - p.start.y) * t + Math.sin(Math.PI * t) * p.arc
        p.mesh.position.set(x, y, z)
        const dx = p.end.x - p.start.x, dz = p.end.z - p.start.z
        p.mesh.rotation.y = Math.atan2(dx, dz)
        p.mesh.rotation.x = -Math.atan2(p.end.y - p.start.y + Math.cos(Math.PI * t) * p.arc * Math.PI, Math.hypot(dx, dz))
        if (p.trail && Math.random() < 0.65) {
          this.smokePuff(p.mesh.position, p.kind === 'bomb' ? 0.5 : 0.35)
        }
      }
    },

    updateEffects(dt) {
      for (let i = this.effects.length - 1; i >= 0; i--) {
        const e = this.effects[i]
        e.ttl -= dt
        if (e.update) e.update(e, dt)
        if (e.ttl <= 0) {
          if (e.obj) {
            e.obj.parent?.remove(e.obj)
            e.obj.geometry?.dispose()
            if (e.obj.material) {
              if (Array.isArray(e.obj.material)) e.obj.material.forEach(m => m.dispose())
              else e.obj.material.dispose()
            }
          }
          this.effects.splice(i, 1)
        }
      }
    },

    updateStrikes(dt) {
      for (let i = this.strikes.length - 1; i >= 0; i--) {
        const s = this.strikes[i]
        s.t -= dt
        if (s.t <= 0) {
          this.strikes.splice(i, 1)
          this.spawnArtilleryRound(s)
        }
      }
    },

    updateWrecks(dt) {
      for (let i = this.wrecks.length - 1; i >= 0; i--) {
        const w = this.wrecks[i]
        w.ttl -= dt
        w.smoke -= dt
        if (w.smoke <= 0) {
          w.smoke = 0.5 + Math.random() * 0.8
          this.particles.smoke(w.obj.position, { count: 1, color: 0x2d2c28, size: 1.8, life: 2.6, rise: 1.4, alpha: 0.35 })
        }
        if (w.ttl <= 0) {
          this.scene.remove(w.obj)
          w.obj.traverse(o => { if (o.isMesh) o.geometry?.dispose() })
          this.wrecks.splice(i, 1)
        }
      }
    },

    updateAI(dt) {
      if (this.gameOver) return
      this.ai.think -= dt
      if (this.ai.think <= 0) {
        this.ai.think = 1.1
        this.aiThink()
      }
      this.ai.attack -= dt
      if (this.ai.attack <= 0) {
        this.ai.attack = 34 + Math.random() * 15
        if (this.elapsed > 36) this.aiAttack()
      }
      this.ai.guard -= dt
      if (this.ai.guard <= 0) {
        this.ai.guard = 1.3
        const threat = this.playerUnits.find(u => u.kind === 'unit' && Math.hypot(u.x - this.enemyBase.x, u.z - this.enemyBase.z) < 62)
        if (threat) {
          for (const u of this.enemyUnits) {
            if (u.orderType === 'idle' && u.canAttack(threat)) u.attack(threat)
          }
        }
      }
    },

    aiThink() {
      const ehq = this.findBuilding('enemy', 'hq')
      if (!ehq) return
      const barracks = this.findBuilding('enemy', 'barracks')
      const factory = this.findBuilding('enemy', 'factory')
      const airfield = this.findBuilding('enemy', 'airfield')
      const depots = this.enemyBuildings.filter(b => b.def.key === 'depot').length
      const turrets = this.enemyBuildings.filter(b => b.def.key === 'turret').length

      if (!barracks && this.enemySupplies > 500) this.aiBuild('barracks')
      if (!factory && this.enemySupplies > 800) this.aiBuild('factory')
      if (depots < 3 && this.enemySupplies > 700 && this.elapsed > 30) this.aiBuild('depot')
      if (turrets < 3 && this.enemySupplies > 680 && this.elapsed > 45) this.aiBuild('turret')
      if (!airfield && this.enemySupplies > 1100 && this.elapsed > 95) this.aiBuild('airfield')

      const e = this.enemyRoster
      const pick = (cat, key) => e.find(u => u.category === cat && u.key === key)
      if (barracks && barracks.built && barracks.queue.length < 2) {
        const options = ['rifleman', 'assault', 'gunner', 'marksman']
        const key = options[Math.floor(Math.random() * options.length)]
        this.queueForTeam(pick('soldier', key), barracks, 'enemy')
      }
      if (factory && factory.built && factory.queue.length < 2) {
        const tankKeys = ['light', 'medium', 'medium', 'heavy']
        const chooseTank = Math.random() < 0.6
        if (chooseTank) this.queueForTeam(pick('tank', tankKeys[Math.floor(Math.random() * tankKeys.length)]), factory, 'enemy')
        else this.queueForTeam(pick('vehicle', Math.random() < 0.65 ? 'apc' : 'recon'), factory, 'enemy')
      }
      if (airfield && airfield.built && airfield.queue.length < 1 && this.enemySupplies > 700) {
        this.queueForTeam(pick('plane', Math.random() < 0.65 ? 'fighter' : 'bomber'), airfield, 'enemy')
      }
    },

    aiBuild(key) {
      const def = this.buildingsByKey[key]
      if (!def || this.enemySupplies < def.cost) return false
      const offsets = [
        [-30, 24], [30, -24], [-24, -30], [24, 30], [0, 34], [34, 0], [-34, 0], [0, -34],
        [-38, 18], [38, -18], [-18, 38], [18, -38],
      ]
      for (const [dx, dz] of offsets) {
        const x = this.enemyBase.x + dx
        const z = this.enemyBase.z + dz
        if (this.isPlacementValid(def, x, z, 'enemy')) {
          this.enemySupplies -= def.cost
          this.spawnBuilding(def, 'enemy', x, z, false)
          return true
        }
      }
      return false
    },

    aiAttack() {
      const candidates = this.enemyUnits.filter(u => u.orderType === 'idle' && u.def.category !== 'plane')
      if (candidates.length < 2) return
      const targetHq = this.findBuilding('player', 'hq') || this.playerBuildings[0]
      if (!targetHq) return
      const group = candidates.slice(0, 8)
      group.forEach((u, i) => {
        const angle = (i / group.length) * Math.PI * 2
        const x = targetHq.x + Math.cos(angle) * (10 + (i % 3) * 4)
        const z = targetHq.z + Math.sin(angle) * (10 + (i % 3) * 4)
        u.moveTo(x, z, true)
      })
      const planes = this.enemyUnits.filter(u => u.def.category === 'plane' && u.orderType === 'idle')
      for (const p of planes) p.moveTo(targetHq.x, targetHq.z)
      this.aiNotify(`ENEMY OFFENSIVE · ${group.length + planes.length} CONTACTS INBOUND`, 'warn')
    },

    aiNotify(text, type = 'warn') {
      if (this.elapsed - (this.lastAiNotify || -99) < 5) return
      this.lastAiNotify = this.elapsed
      this.ui?.toast(text, type)
    },

    alertBase(building) {
      this.baseAlert = 4.5
      if (this.elapsed - this.lastBaseAlert > 11) {
        this.lastBaseAlert = this.elapsed
        this.ui?.toast('BASE UNDER ATTACK · DEFEND THE PERIMETER', 'warn')
      }
    },

    checkVictory() {
      if (this.gameOver) return
      if (!this.findBuilding('enemy', 'hq')) this.endGame(true)
      else if (!this.findBuilding('player', 'hq')) this.endGame(false)
    },

    endGame(victory) {
      if (this.gameOver) return
      this.gameOver = true
      this.endVictory = victory
      this.endTimer = 0
      this.endShown = false
      this.cancelModes()
      this.ui.setPlacement(null)
      this.ui.setLock(null)
      this.ui.hideEnd()
      this.sfx[victory ? 'victory' : 'defeat']()
    },

    drawOverlay() {
      if (!this.overlay) {
        this.overlay = document.createElement('canvas')
        this.overlay.id = 'hud-overlay'
        document.getElementById('app').appendChild(this.overlay)
        this.overlayCtx = this.overlay.getContext('2d')
      }
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = this.viewW, h = this.viewH
      if (this.overlay.width !== Math.floor(w * dpr) || this.overlay.height !== Math.floor(h * dpr)) {
        this.overlay.width = Math.floor(w * dpr)
        this.overlay.height = Math.floor(h * dpr)
        this.overlay.style.width = `${w}px`
        this.overlay.style.height = `${h}px`
      }
      const ctx = this.overlayCtx
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      const project = (x, y, z) => {
        const v = new THREE.Vector3(x, y, z).project(this.camera)
        return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, on: v.z > -1 && v.z < 1 }
      }
      // health bars
      for (const u of this.units) {
        if (u.dead) continue
        const selected = u.selected
        const damaged = u.hp < u.maxHp - 0.5
        if (!selected && !damaged) continue
        const hgt = u.def.category === 'soldier' ? 2.9 : u.def.category === 'plane' ? 2.2 : 3.2
        const p = project(u.x, u.model.position.y + hgt, u.z)
        if (!p.on || p.x < -50 || p.x > w + 50 || p.y < 0 || p.y > h) continue
        const bw = u.def.category === 'soldier' ? 26 : u.def.category === 'plane' ? 34 : 40
        this.bar(ctx, p.x - bw / 2, p.y, bw, 3, u.hp / u.maxHp, u.team === 'player' ? '#7ad9c5' : '#e0705a', selected)
      }
      for (const b of this.buildings) {
        if (b.dead) continue
        if (!b.selected && b.hp >= b.maxHp - 0.5 && b.built) continue
        const p = project(b.x, b.model.position.y + (b.def.key === 'hq' ? 12 : 7), b.z)
        if (!p.on || p.x < -60 || p.x > w + 60 || p.y < 0 || p.y > h) continue
        const bw = b.def.key === 'hq' ? 64 : 48
        if (!b.built) {
          this.bar(ctx, p.x - bw / 2, p.y, bw, 4, b.progress, '#d3b77b', true)
          ctx.font = '600 8px "IBM Plex Mono", monospace'
          ctx.fillStyle = '#d3b77b'
          ctx.textAlign = 'center'
          ctx.fillText(`${Math.round(b.progress * 100)}%`, p.x, p.y - 4)
        } else {
          this.bar(ctx, p.x - bw / 2, p.y, bw, 4, b.hp / b.maxHp, b.team === 'player' ? '#7ad9c5' : '#e0705a', b.selected)
        }
      }
      // capture point letter chips
      for (const c of this.capturePoints) {
        const p = project(c.x, c.group.position.y + 15.5, c.z)
        if (!p.on) continue
        const color = c.owner === 'player' ? '#7ad9c5' : c.owner === 'enemy' ? '#e0705a' : '#d3b77b'
        ctx.font = '600 9px "IBM Plex Mono", monospace'
        ctx.textAlign = 'center'
        ctx.fillStyle = 'rgba(8,10,7,0.7)'
        ctx.fillRect(p.x - 16, p.y - 7, 32, 12)
        ctx.strokeStyle = color
        ctx.lineWidth = 1
        ctx.strokeRect(p.x - 16, p.y - 7, 32, 12)
        ctx.fillStyle = color
        const label = c.contested ? '!' : c.owner === 'player' ? `${c.letter} HOLD` : c.owner === 'enemy' ? `${c.letter} LOST` : `${c.letter}`
        ctx.fillText(label, p.x, p.y + 2.5)
      }
      if (this.baseAlert > 0) {
        const a = Math.min(0.32, this.baseAlert * 0.08)
        const grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.28, w / 2, h / 2, Math.max(w, h) * 0.7)
        grad.addColorStop(0, 'rgba(224,112,90,0)')
        grad.addColorStop(1, `rgba(224,112,90,${a})`)
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, w, h)
      }
    },

    bar(ctx, x, y, w, h, ratio, color, selected) {
      ratio = clamp(ratio, 0, 1)
      ctx.fillStyle = 'rgba(6,9,6,0.78)'
      ctx.fillRect(x - 1, y - 1, w + 2, h + 2)
      ctx.fillStyle = color
      ctx.fillRect(x, y, w * ratio, h)
      if (selected) {
        ctx.strokeStyle = 'rgba(255,255,255,0.7)'
        ctx.lineWidth = 1
        ctx.strokeRect(x - 2, y - 2, w + 4, h + 4)
      }
    },

    resize(w, h) {
      this.viewW = w
      this.viewH = h
      this.camera.aspect = w / h
      this.camera.updateProjectionMatrix()
      if (this.overlay) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        this.overlay.width = Math.floor(w * dpr)
        this.overlay.height = Math.floor(h * dpr)
        this.overlay.style.width = `${w}px`
        this.overlay.style.height = `${h}px`
      }
    },

    dispose() {
      this.disposed = true
      this.abort?.abort()
      this.cancelModes()
      this.ui?.dispose()
      this.weather?.dispose()
      this.particles?.dispose()
      this.sparks?.dispose()
      this.overlay?.remove()
      this.terrain?.dispose()
      this.scene.traverse(obj => {
        if (obj.isMesh || obj.isLine || obj.isPoints) {
          obj.geometry?.dispose()
          if (obj.material && obj.material !== UNIT_MATERIAL && obj.material !== WRECK_MATERIAL) {
            if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose())
            else obj.material.dispose()
          }
        }
      })
      this.scene.clear()
      this.units.length = 0
      this.buildings.length = 0
      this.selection.length = 0
    },
  })
}
