import * as THREE from 'three'
import { ERAS, getEra, getFaction, factionsForEra, rivalOf, rosterFor } from './data.js'
import { Terrain } from './terrain.js'
import { createUnitModel, createBuildingModel, UNIT_MATERIAL } from './models.js'
import { sfx } from './sfx.js'

function eraById(id) { return ERAS.find(e => e.id === id) }
function mapOf(eraId, mapId) { return eraById(eraId).maps.find(m => m.id === mapId) || eraById(eraId).maps[0] }

function drawMapThumb(canvas, map) {
  const ctx = canvas.getContext('2d')
  const w = canvas.width, h = canvas.height
  const [c0, c1, c2] = map.thumbnail
  const grad = ctx.createLinearGradient(0, 0, w, h)
  grad.addColorStop(0, c0)
  grad.addColorStop(0.55, c1)
  grad.addColorStop(1, c2)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)
  // hillshade bands
  const rnd = mulberry(map.id.length * 97 + map.id.charCodeAt(0))
  ctx.globalAlpha = 0.22
  for (let i = 0; i < 26; i++) {
    const y = (i / 26) * h + rnd() * 4
    const amp = 4 + rnd() * 12
    ctx.beginPath()
    ctx.moveTo(-10, y)
    for (let x = 0; x <= w + 10; x += 8) {
      const yy = y + Math.sin(x * 0.03 + i * 0.9 + map.id.length) * amp * 0.18 + Math.sin(x * 0.011 + i) * amp * 0.12
      ctx.lineTo(x, yy)
    }
    ctx.strokeStyle = i % 2 ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.45)'
    ctx.lineWidth = 1
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  if (map.water) {
    ctx.fillStyle = 'rgba(37,112,124,0.78)'
    ctx.beginPath()
    ctx.ellipse(w * 0.52, h * 0.52, w * 0.3, h * 0.28, 0.2, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = c2
    ctx.beginPath()
    ctx.ellipse(w * 0.52, h * 0.52, w * 0.19, h * 0.15, 0.1, 0, Math.PI * 2)
    ctx.fill()
  }
  if (map.type === 'stalingrad' || map.type === 'seoul') {
    ctx.fillStyle = 'rgba(20,22,22,0.55)'
    for (let i = 0; i < 26; i++) {
      const bw = 4 + rnd() * 12, bh = 4 + rnd() * 12
      ctx.fillRect(rnd() * w, rnd() * h, bw, bh)
    }
  }
  if (map.type === 'desertStorm' || map.type === 'sinai') {
    ctx.strokeStyle = 'rgba(80,64,38,0.5)'
    for (let i = 0; i < 8; i++) {
      ctx.beginPath()
      ctx.moveTo(rnd() * w, 0)
      ctx.bezierCurveTo(rnd() * w, h * 0.4, rnd() * w, h * 0.6, rnd() * w, h)
      ctx.stroke()
    }
  }
  // tactical overlay
  ctx.strokeStyle = 'rgba(255,255,255,0.2)'
  ctx.lineWidth = 1
  ctx.strokeRect(w * 0.12, h * 0.18, w * 0.76, h * 0.64)
  ctx.beginPath()
  ctx.arc(w * 0.5, h * 0.5, 3, 0, Math.PI * 2)
  ctx.fillStyle = '#d3b77b'
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.15)'
  ctx.beginPath()
  ctx.moveTo(w * 0.5, 0); ctx.lineTo(w * 0.5, h)
  ctx.moveTo(0, h * 0.5); ctx.lineTo(w, h * 0.5)
  ctx.stroke()
}

function mulberry(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0
    let t = Math.imul(a ^ a >>> 15, 1 | a)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

const countFor = (era) => era.factions.reduce((n, id) => n + rosterFor(id).length, 0)

export class MenuUI {
  constructor(state, { onChange, onStart }) {
    this.state = state
    this.onChange = onChange
    this.onStart = onStart
    this.$ = id => document.getElementById(id)
    this.el = {
      eraList: this.$('era-list'), mapList: this.$('map-list'), factionList: this.$('faction-list'),
      eraNote: this.$('era-note'), mapBrief: this.$('map-brief-text'),
      player: this.$('matchup-player'), playerSub: this.$('matchup-player-sub'),
      enemy: this.$('matchup-enemy'), enemySub: this.$('matchup-enemy-sub'),
      meta: this.$('start-meta'), sound: this.$('sound-toggle-menu'),
    }
    this.el.start = this.$('start-btn')
    this.el.start.addEventListener('click', () => { sfx.init(); sfx.click(); this.onStart() })
    this.el.sound.addEventListener('click', () => {
      sfx.init()
      sfx.setEnabled(!sfx.enabled)
      this.el.sound.textContent = `SOUND: ${sfx.enabled ? 'ON' : 'OFF'}`
    })
    this.render()
  }

  era() { return getEra(this.state.eraId) }
  faction() { return getFaction(this.state.factionId) }
  map() { return mapOf(this.state.eraId, this.state.mapId) }

  setEra(id) {
    const era = getEra(id)
    this.state.eraId = id
    this.state.mapId = era.maps[0].id
    if (!era.factions.includes(this.state.factionId)) this.state.factionId = era.factions[0]
    sfx.init(); sfx.click()
    this.render()
    this.onChange()
  }

  setMap(id) {
    this.state.mapId = id
    sfx.click()
    this.render()
    this.onChange()
  }

  setFaction(id) {
    this.state.factionId = id
    sfx.click()
    this.render()
    this.onChange()
  }

  render() {
    const era = this.era()
    const faction = this.faction()
    const map = this.map()
    this.state.mapId = map.id
    document.body.dataset.era = era.id
    document.documentElement.style.setProperty('--faction', faction.colors.ui || era.accent)
    this.el.meta.textContent = `${map.name.toUpperCase()} · ${map.region.split(' · ')[1] || era.years}`

    this.el.eraList.innerHTML = ERAS.map(e => `
      <button class="era-card ${e.id === era.id ? 'active' : ''}" data-era="${e.id}" type="button">
        <span class="era-numeral">${e.numeral}</span>
        <span>
          <span class="era-name">${e.name}</span>
          <span class="era-years">${e.years}</span>
          <span class="era-tag">${e.tagline}</span>
        </span>
        <span class="era-count"><b>${e.maps.length}</b>MAPS<b>${countFor(e)}</b>UNITS</span>
      </button>`).join('')
    this.el.eraList.querySelectorAll('[data-era]').forEach(b => b.addEventListener('click', () => this.setEra(b.dataset.era)))

    this.el.mapList.innerHTML = era.maps.map(m => `
      <button class="map-card ${m.id === map.id ? 'active' : ''}" data-map="${m.id}" type="button">
        <span class="map-thumb"><span class="map-scan">SECTOR ${m.region.split(' · ')[1] || ''}</span><canvas width="208" height="132"></canvas></span>
        <span class="map-info">
          <span class="map-name">${m.name}</span>
          <span class="map-region">${m.region}</span>
          <span class="map-tags"><span>${(m.weather || 'clear').toUpperCase()}</span><span>${m.props === 'palms' || m.water ? 'LITTORAL' : m.props === 'urbanSnow' || m.props === 'city' ? 'URBAN' : 'OPEN'}</span><span>DYNAMIC TERRAIN</span></span>
        </span>
      </button>`).join('')
    this.el.mapList.querySelectorAll('[data-map]').forEach((b, i) => {
      const cv = b.querySelector('canvas')
      drawMapThumb(cv, era.maps[i])
      b.addEventListener('click', () => this.setMap(b.dataset.map))
    })

    this.el.factionList.innerHTML = factionsForEra(era.id).map(f => {
      const bars = [
        ['FIRE', f.mods.dmg],
        ['ARMOR', f.mods.hp],
        ['MOBIL', f.mods.speed],
        ['AIR', f.mods.air || 1],
      ]
      return `<button class="faction-card ${f.id === faction.id ? 'active' : ''}" data-faction="${f.id}" style="--fc:${f.colors.ui}" type="button">
        <span class="faction-emblem">${f.monogram}</span>
        <span class="faction-meta">
          <span class="faction-name">${f.name}</span>
          <span class="faction-doctrine">${f.doctrine}</span>
          <span class="faction-blurb">${f.blurb}</span>
        </span>
        <span class="faction-bars">${bars.map(([k, v]) => `<span style="--v:${Math.max(0.25, Math.min(1, (v - 0.8) / 0.45))}" title="${k}"></span>`).join('')}</span>
      </button>`
    }).join('')
    this.el.factionList.querySelectorAll('[data-faction]').forEach(b => b.addEventListener('click', () => this.setFaction(b.dataset.faction)))

    this.el.eraNote.innerHTML = `<b style="color:var(--accent);font-family:var(--font-mono);font-size:8px;letter-spacing:.14em">${era.weatherNote.toUpperCase()}</b><br>${era.description}`
    this.el.mapBrief.textContent = map.brief

    const rival = rivalOf(faction)
    this.el.player.textContent = faction.name.toUpperCase()
    this.el.playerSub.textContent = faction.doctrine
    this.el.enemy.textContent = rival.name.toUpperCase()
    this.el.enemySub.textContent = rival.doctrine
    this.el.start.querySelector('.start-meta').textContent = `${map.name.toUpperCase()} · ${map.region.split(' · ')[1] || era.years}`
  }
}

export class MenuScene {
  constructor(renderer, state) {
    this.renderer = renderer
    this.state = { ...state }
    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.5, 1500)
    this.map = mapOf(state.eraId, state.mapId)
    this.faction = getFaction(state.factionId)
    this.era = getEra(state.eraId)
    this.time = 0
    this.showcase = new THREE.Group()
    this.scene.add(this.showcase)
    this.terrain = new Terrain(this.map, this.scene)
    this.lights = this.makeLights()
    this.buildShowcase()
    this.planeAngle = 0
    this.disposed = false
  }

  makeLights() {
    const hemi = new THREE.HemisphereLight(this.map.palette.sky, this.map.palette.low, 1.55)
    this.scene.add(hemi)
    const sun = new THREE.DirectionalLight(this.map.palette.sun, 2.5)
    sun.position.set(-110, 170, 80)
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    sun.shadow.camera.left = -80
    sun.shadow.camera.right = 80
    sun.shadow.camera.top = 80
    sun.shadow.camera.bottom = -80
    sun.shadow.camera.far = 400
    sun.shadow.bias = -0.0005
    this.scene.add(sun)
    return { hemi, sun }
  }

  buildShowcase() {
    const base = { x: -124, z: 120 }
    const faction = this.faction
    const era = this.era
    const buildingsByKey = {
      hq: { key: 'hq', era: era.id, size: 15, name: 'HQ', produces: [] },
      barracks: { key: 'barracks', era: era.id, size: 10, name: 'Barracks', produces: ['soldier'] },
      factory: { key: 'factory', era: era.id, size: 12, name: 'Factory', produces: ['vehicle', 'tank'] },
    }
    const hq = createBuildingModel(buildingsByKey.hq, faction)
    hq.position.set(base.x - 2, this.terrain.sample(base.x - 2, base.z - 2), base.z - 2)
    hq.rotation.y = 0.25
    this.showcase.add(hq)
    const barracks = createBuildingModel(buildingsByKey.barracks, faction)
    barracks.position.set(base.x + 14, this.terrain.sample(base.x + 14, base.z + 9), base.z + 9)
    barracks.rotation.y = -0.5
    barracks.scale.setScalar(0.95)
    this.showcase.add(barracks)
    const factory = createBuildingModel(buildingsByKey.factory, faction)
    factory.position.set(base.x - 17, this.terrain.sample(base.x - 17, base.z - 9), base.z - 9)
    factory.rotation.y = 0.8
    factory.scale.setScalar(0.9)
    this.showcase.add(factory)

    const roster = rosterFor(faction)
    const pick = (cat, key) => roster.find(u => u.category === cat && u.key === key)
    const place = (unit, x, z, rot = 0) => {
      if (!unit) return
      const m = createUnitModel(unit)
      m.position.set(x, this.terrain.sample(x, z) + 0.05, z)
      m.rotation.y = rot
      this.showcase.add(m)
      return m
    }
    place(pick('soldier', 'rifleman'), base.x + 4, base.z + 15, -0.6)
    place(pick('soldier', 'assault'), base.x + 7, base.z + 13, 0.2)
    place(pick('soldier', 'gunner'), base.x + 1, base.z + 16, -0.3)
    place(pick('soldier', 'marksman'), base.x + 10, base.z + 15, -0.1)
    place(pick('tank', 'medium'), base.x + 7, base.z - 2, -0.45)
    place(pick('tank', 'heavy'), base.x - 7, base.z + 1, 0.25)
    place(pick('vehicle', 'recon'), base.x + 17, base.z - 1, -0.7)
    this.plane = place(pick('plane', 'fighter'), base.x + 2, base.z + 6, 0)
    if (this.plane) this.plane.position.y += 17
    this.base = base
  }

  update(dt) {
    if (this.disposed) return
    this.time += dt
    const t = this.time
    const base = this.base
    const yaw = -0.95 + Math.sin(t * 0.08) * 0.2
    const dist = 54 + Math.sin(t * 0.11) * 4
    const height = 20 + Math.sin(t * 0.07) * 2
    this.camera.position.set(
      base.x + Math.sin(yaw) * dist,
      Math.max(this.terrain.sample(base.x, base.z) + height, 12),
      base.z + Math.cos(yaw) * dist,
    )
    this.camera.lookAt(base.x + 6, this.terrain.sample(base.x, base.z) + 5, base.z - 2)
    this.planeAngle += dt * 0.12
    if (this.plane) {
      const r = 33
      const px = base.x + Math.cos(this.planeAngle) * r
      const pz = base.z + Math.sin(this.planeAngle) * r
      this.plane.position.set(px, this.terrain.sample(px, pz) + 18 + Math.sin(t * 0.7) * 1.2, pz)
      this.plane.rotation.y = -this.planeAngle + Math.PI / 2
      this.plane.rotation.z = -0.12
    }
    this.showcase.traverse(o => {
      if (o.userData?.prop && this.plane && o.parent === this.plane) o.rotation.z += dt * 30
    })
    if (this.plane?.userData?.prop) this.plane.userData.prop.rotation.z += dt * 28
    this.terrain.update(dt, t)
    // flags ripple
    this.showcase.traverse(o => {
      if (o.userData?.isFlag) o.rotation.y = Math.sin(t * 2 + o.position.x) * 0.18
    })
  }

  resize(w, h) {
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  dispose() {
    this.disposed = true
    this.scene.traverse(o => {
      if (o.isMesh) {
        o.geometry?.dispose()
        if (o.material && o.material !== UNIT_MATERIAL && !o.material.userData?.keep) {
          if (Array.isArray(o.material)) o.material.forEach(m => m.dispose())
          else o.material.dispose()
        }
      }
    })
    this.terrain.dispose()
    this.scene.clear()
    this.renderer.setClearColor(0x0d100c, 0)
  }
}

export { drawMapThumb }
