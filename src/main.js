import './style.css'
import * as THREE from 'three'
import { World } from './world.js'
import { Player } from './player.js'
import { createEnvironment } from './environment.js'
import { Effects } from './effects.js'
import { AudioEngine } from './audio.js'
import { Critters } from './critters.js'
import { BLOCK, BLOCKS, HOTBAR } from './blocks.js'
import { atlasTexture, drawBlockIcon } from './textures.js'

const $ = (selector) => document.querySelector(selector)
const canvas = $('#game')
const loading = $('#loading')
const loadingBar = $('#loadingBar')
const loadingText = $('#loadingText')
const titleScreen = $('#titleScreen')
const startBtn = $('#startBtn')
const hud = $('#hud')
const hotbarEl = $('#hotbar')
const heartsEl = $('#hearts')
const selectedBlockEl = $('#selectedBlock')
const coordEl = $('#coordValue')
const modeChip = $('#modeChip')
const toastEl = $('#toast')
const pauseScreen = $('#pauseScreen')
const deathScreen = $('#deathScreen')
const deathReason = $('#deathReason')
const underwaterOverlay = $('#underwaterOverlay')
const damageOverlay = $('#damageOverlay')
const mobileControls = $('#mobileControls')
const joystick = $('#joystick')
const joystickKnob = $('#joystickKnob')
const seedLabel = $('#seedLabel')
const oxygenEl = $('#oxygen')
const oxygenPips = $('#oxygenPips')

const params = new URLSearchParams(location.search)
const seed = Number(params.get('seed')) || 20260214
const isTouch = window.matchMedia('(any-pointer: coarse)').matches || ('ontouchstart' in window && navigator.maxTouchPoints > 0)
seedLabel.textContent = seed.toLocaleString('en-US').replace(/,/g, ' ')
if (isTouch) {
  const note = document.querySelector('.menu-note')
  if (note) note.textContent = 'Tap to begin · drag to look · use the joystick to move'
}

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance',
  stencil: false,
})
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouch ? 1.5 : 2))
renderer.setSize(window.innerWidth, window.innerHeight, false)
renderer.setClearColor(0xa9d6ea, 1)
renderer.autoClear = false
atlasTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 700)
camera.rotation.order = 'YXZ'

const world = new World(scene, seed, isTouch ? 5 : 6)
const effects = new Effects(scene)
const audio = new AudioEngine()
const environment = createEnvironment(scene, renderer)

const spawn = world.findSpawn()
let player
let critters
let started = false
let paused = false
let pointerEverLocked = false
let ignoreMouseUntil = 0
let mining = false
let lastDamageCause = 'the fall'
let toastTimer = 0
let selectedIndex = 0
let lastHudUpdate = 0
let damageHideTimer = 0

// ---------------------------------------------------------------- held item
const handScene = new THREE.Scene()
const handCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 10)
handCamera.position.set(0, 0, 0)
handScene.add(new THREE.AmbientLight(0xffffff, 1.45))
const handSun = new THREE.DirectionalLight(0xfff3d7, 2.2)
handSun.position.set(-1.2, 1.7, 1.3)
handScene.add(handSun)
const handRim = new THREE.DirectionalLight(0x9ed7ff, 0.65)
handRim.position.set(1.8, 0.3, -0.5)
handScene.add(handRim)

const heldRoot = new THREE.Group()
heldRoot.position.set(0.55, -0.46, -1.55)
heldRoot.rotation.set(0.12, -0.58, 0.12)
handScene.add(heldRoot)
const heldBlock = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), [])
heldBlock.position.set(0, 0.03, 0)
heldRoot.add(heldBlock)
const tileTextureCache = new Map()
function tileTexture(tile) {
  if (tileTextureCache.has(tile)) return tileTextureCache.get(tile)
  const texture = atlasTexture.clone()
  const col = tile % 8
  const row = Math.floor(tile / 8)
  texture.repeat.set(1 / 8, 1 / 8)
  texture.offset.set(col / 8, 1 - (row + 1) / 8)
  texture.needsUpdate = true
  tileTextureCache.set(tile, texture)
  return texture
}

function heldMaterials(blockId) {
  const block = BLOCKS[blockId]
  const side = new THREE.MeshLambertMaterial({ map: tileTexture(block.tiles.side) })
  const top = new THREE.MeshLambertMaterial({ map: tileTexture(block.tiles.top) })
  const bottom = new THREE.MeshLambertMaterial({ map: tileTexture(block.tiles.bottom) })
  return [side, side, top, bottom, side, side]
}
heldBlock.material = heldMaterials(HOTBAR[0])

// ---------------------------------------------------------------- UI setup
const slotCanvases = []
HOTBAR.forEach((blockId, index) => {
  const slot = document.createElement('div')
  slot.className = 'hotbar-slot'
  const icon = document.createElement('canvas')
  drawBlockIcon(icon, blockId, 38)
  const key = document.createElement('span')
  key.className = 'slot-key'
  key.textContent = String(index + 1)
  slot.append(icon, key)
  slot.addEventListener('pointerdown', (event) => {
    if (!started || paused || player?.dead) return
    event.preventDefault()
    event.stopPropagation()
    setSelected(index)
  })
  hotbarEl.append(slot)
  slotCanvases.push({ slot, icon })
})
drawBlockIcon($('#brandBlock'), BLOCK.GRASS, 28)
drawBlockIcon($('#menuBlockIcon'), BLOCK.GRASS, 118)

for (let i = 0; i < 10; i++) {
  const heart = document.createElement('span')
  heart.className = 'heart'
  heart.textContent = '♥'
  heartsEl.append(heart)
}
for (let i = 0; i < 10; i++) {
  const pip = document.createElement('span')
  pip.className = 'oxygen-pip'
  oxygenPips.append(pip)
}

function setSelected(index, announce = true) {
  selectedIndex = (index + HOTBAR.length) % HOTBAR.length
  const id = HOTBAR[selectedIndex]
  slotCanvases.forEach(({ slot }, i) => slot.classList.toggle('selected', i === selectedIndex))
  heldBlock.material = heldMaterials(id)
  selectedBlockEl.textContent = BLOCKS[id].name
  selectedBlockEl.classList.remove('pop')
  void selectedBlockEl.offsetWidth
  selectedBlockEl.classList.add('pop')
  setTimeout(() => selectedBlockEl.classList.remove('pop'), 170)
  if (announce) audio.select()
}

function updateHealth(health) {
  const hearts = heartsEl.children
  for (let i = 0; i < hearts.length; i++) {
    const value = health - i * 2
    hearts[i].className = value >= 2 ? 'heart' : value > 0 ? 'heart half' : 'heart empty'
  }
}

function updateOxygen() {
  if (!player) return
  const ratio = player.oxygen / 300
  const show = player.headInWater || ratio < 0.99
  oxygenEl.classList.toggle('is-hidden', !show)
  const pips = oxygenPips.children
  for (let i = 0; i < pips.length; i++) pips[i].classList.toggle('off', i / pips.length > ratio)
}

function showToast(text, duration = 2400) {
  toastEl.textContent = text
  toastEl.classList.add('show')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), duration)
}

function flashDamage() {
  damageOverlay.style.opacity = '0.82'
  clearTimeout(damageHideTimer)
  damageHideTimer = setTimeout(() => { damageOverlay.style.opacity = '0' }, 130)
}

function setModeChip() {
  modeChip.textContent = player?.flying ? 'FLYING' : 'SURVIVAL'
  modeChip.classList.toggle('flying', Boolean(player?.flying))
}

function showPause() {
  if (!started || paused || player.dead) return
  paused = true
  pauseScreen.classList.remove('is-hidden')
  mining = false
  player.input.jump = false
  if (document.pointerLockElement) document.exitPointerLock()
}

function hidePause(requestLock = true) {
  paused = false
  pauseScreen.classList.add('is-hidden')
  canvas.focus()
  if (requestLock && !isTouch) requestPointerLock()
}

function requestPointerLock() {
  if (isTouch || document.pointerLockElement === canvas) return
  ignoreMouseUntil = performance.now() + 600
  try {
    const promise = canvas.requestPointerLock()
    if (promise?.catch) promise.catch(() => {})
  } catch {}
}

function triggerSwing() {
  swingRemaining = 0.3
}
let swingRemaining = 0

function placeSelectedBlock() {
  if (!player) return
  player.updateTarget(true)
  const blockId = HOTBAR[selectedIndex]
  const placed = player.placeBlock(blockId, true, () => triggerSwing())
  if (!placed) triggerSwing()
}

// ---------------------------------------------------------------- start & pause
function beginGame() {
  if (started) return
  started = true
  audio.init()
  audio.click()
  titleScreen.classList.add('is-hidden')
  titleScreen.style.display = 'none'
  loading.classList.add('is-hidden')
  loading.style.display = 'none'
  hud.classList.remove('is-hidden')
  if (isTouch) mobileControls.classList.remove('is-hidden')
  canvas.focus()
  if (!isTouch) requestPointerLock()
  setTimeout(() => {
    if (!paused && !player.dead) showToast(isTouch ? 'Drag to look · joystick to move' : 'WASD to move · hold left click to mine', 2600)
  }, 1800)
}

startBtn.addEventListener('click', beginGame)
canvas.addEventListener('click', () => {
  if (!started || paused || player?.dead) return
  if (!isTouch && !document.pointerLockElement) requestPointerLock()
})
$('#hudPause').addEventListener('click', () => showPause())
$('#resumeBtn').addEventListener('click', () => hidePause(true))
$('#pauseMuteBtn').addEventListener('click', toggleMute)
$('#muteBtn').addEventListener('click', toggleMute)
$('#respawnBtn').addEventListener('click', () => {
  player.respawn()
  hidePause(true)
  showToast('Back at the shoreline', 1800)
})
$('#deathRespawn').addEventListener('click', () => {
  player.respawn()
  deathScreen.classList.add('is-hidden')
  paused = false
  if (!isTouch) requestPointerLock()
})
$('#seedLabel').addEventListener('click', () => {
  navigator.clipboard?.writeText(String(seed)).then(() => showToast('Seed copied'))
})

function toggleMute() {
  audio.init()
  audio.setMuted(!audio.muted)
  const label = audio.muted ? 'Sound: Off' : 'Sound: On'
  $('#pauseMuteBtn').textContent = label
  $('#muteBtn').textContent = audio.muted ? 'SOUND OFF' : 'SOUND ON'
  if (started) showToast(audio.muted ? 'Sound muted' : 'Sound on', 1200)
}

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas) {
    pointerEverLocked = true
    ignoreMouseUntil = performance.now() + 180
    if (paused) hidePause(false)
  } else if (started && pointerEverLocked && !player.dead && !paused) {
    showPause()
  }
})

document.addEventListener('visibilitychange', () => {
  if (document.hidden && started && !paused && !player.dead) showPause()
})

// ---------------------------------------------------------------- input
const inputMap = {
  KeyW: 'forward', ArrowUp: 'forward',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  Space: 'jump',
  ShiftLeft: 'sprint', ShiftRight: 'sprint',
  ControlLeft: 'descend', ControlRight: 'descend',
}

window.addEventListener('keydown', (event) => {
  if (!started) return
  if (event.code === 'Escape') {
    if (paused) hidePause(true)
    else showPause()
    event.preventDefault()
    return
  }
  if (event.code === 'KeyM') {
    toggleMute()
    event.preventDefault()
    return
  }
  if (event.code === 'KeyF' && !event.repeat) {
    const flying = player.toggleFly()
    setModeChip()
    showToast(flying ? 'Flight enabled — Space up, Ctrl down' : 'Flight disabled', 1900)
    event.preventDefault()
    return
  }
  if (event.code === 'KeyR' && player.dead) {
    player.respawn()
    deathScreen.classList.add('is-hidden')
    paused = false
    return
  }
  const mapped = inputMap[event.code]
  if (mapped) {
    player.input[mapped] = true
    event.preventDefault()
  }
  if (event.code.startsWith('Digit')) {
    const index = Number(event.code.slice(5)) - 1
    if (index >= 0 && index < HOTBAR.length) {
      setSelected(index)
      event.preventDefault()
    }
  }
})

window.addEventListener('keyup', (event) => {
  if (!player) return
  const mapped = inputMap[event.code]
  if (mapped) {
    player.input[mapped] = false
    event.preventDefault()
  }
})

window.addEventListener('blur', () => {
  if (!player) return
  for (const key of Object.values(player.input)) {
    if (typeof key === 'boolean') {
      // only reset booleans; joystick values are handled separately
    }
  }
  player.input.forward = false
  player.input.back = false
  player.input.left = false
  player.input.right = false
  player.input.jump = false
  player.input.sprint = false
  player.input.descend = false
  mining = false
})

window.addEventListener('wheel', (event) => {
  if (!started || paused || player.dead) return
  if (event.deltaY !== 0) {
    setSelected(selectedIndex + (event.deltaY > 0 ? 1 : -1))
    event.preventDefault()
  }
}, { passive: false })

canvas.addEventListener('contextmenu', (event) => event.preventDefault())
canvas.addEventListener('pointerdown', (event) => {
  if (!started || paused || player.dead) return
  if (event.pointerType === 'touch') return
  if (!isTouch && !document.pointerLockElement) {
    requestPointerLock()
    return
  }
  if (event.button === 0) {
    mining = true
    triggerSwing()
    player.updateTarget(true)
  } else if (event.button === 2) {
    placeSelectedBlock()
  }
})
window.addEventListener('pointerup', (event) => {
  if (event.button === 0 || event.pointerType === 'touch') mining = false
})

document.addEventListener('mousemove', (event) => {
  if (!started || paused || player.dead || isTouch) return
  if (performance.now() < ignoreMouseUntil) return
  if (document.pointerLockElement === canvas) {
    player.look(event.movementX, event.movementY)
  }
})

// ---------------------------------------------------------------- touch controls
if (isTouch) {
  const activeTouches = new Map()
  canvas.addEventListener('touchstart', (event) => {
    if (!started || paused || player.dead) return
    for (const touch of event.changedTouches) {
      if (activeTouches.size === 0) {
        activeTouches.set(touch.identifier, { x: touch.clientX, y: touch.clientY, look: true })
        event.preventDefault()
      }
    }
  }, { passive: false })
  canvas.addEventListener('touchmove', (event) => {
    if (!started || paused || player.dead) return
    for (const touch of event.changedTouches) {
      const state = activeTouches.get(touch.identifier)
      if (!state) continue
      const dx = touch.clientX - state.x
      const dy = touch.clientY - state.y
      state.x = touch.clientX
      state.y = touch.clientY
      player.look(dx, dy, 0.0042)
      event.preventDefault()
    }
  }, { passive: false })
  const endTouch = (event) => {
    for (const touch of event.changedTouches) activeTouches.delete(touch.identifier)
  }
  canvas.addEventListener('touchend', endTouch)
  canvas.addEventListener('touchcancel', endTouch)

  let joystickPointer = null
  const updateJoystick = (event) => {
    if (event.pointerId !== joystickPointer) return
    const rect = joystick.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    let dx = event.clientX - cx
    let dy = event.clientY - cy
    const radius = rect.width * 0.33
    const length = Math.hypot(dx, dy)
    if (length > radius) {
      dx = (dx / length) * radius
      dy = (dy / length) * radius
    }
    joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`
    player.setTouchMove(dx / radius, -dy / radius)
    event.preventDefault()
  }
  joystick.addEventListener('pointerdown', (event) => {
    joystickPointer = event.pointerId
    joystick.setPointerCapture(event.pointerId)
    updateJoystick(event)
    event.stopPropagation()
    event.preventDefault()
  })
  joystick.addEventListener('pointermove', (event) => {
    updateJoystick(event)
    event.stopPropagation()
  })
  const releaseJoystick = (event) => {
    if (event.pointerId !== joystickPointer) return
    joystickPointer = null
    joystickKnob.style.transform = ''
    player?.setTouchMove(0, 0)
    event.stopPropagation()
  }
  joystick.addEventListener('pointerup', releaseJoystick)
  joystick.addEventListener('pointercancel', releaseJoystick)

  const bindHold = (id, down, up) => {
    const element = $(id)
    element.addEventListener('pointerdown', (event) => {
      event.stopPropagation()
      event.preventDefault()
      element.setPointerCapture(event.pointerId)
      element.classList.add('pressed')
      down()
    })
    const release = (event) => {
      event.stopPropagation()
      element.classList.remove('pressed')
      up?.()
    }
    element.addEventListener('pointerup', release)
    element.addEventListener('pointercancel', release)
  }
  bindHold('#jumpBtn', () => { player.input.jump = true }, () => { player.input.jump = false })
  bindHold('#breakBtn', () => {
    mining = true
    triggerSwing()
    player.updateTarget(true)
  }, () => { mining = false })
  const placeBtn = $('#placeBtn')
  placeBtn.addEventListener('pointerdown', (event) => {
    event.stopPropagation()
    event.preventDefault()
    placeBtn.classList.add('pressed')
    placeSelectedBlock()
  })
  placeBtn.addEventListener('pointerup', () => placeBtn.classList.remove('pressed'))
  placeBtn.addEventListener('pointercancel', () => placeBtn.classList.remove('pressed'))
}

// ---------------------------------------------------------------- player wiring
function updateHud(now) {
  const elapsed = now - lastHudUpdate
  if (elapsed < 180) return
  lastHudUpdate = now
  coordEl.textContent = `${Math.floor(player.position.x)} · ${Math.floor(player.position.y)} · ${Math.floor(player.position.z)}`
  underwaterOverlay.classList.toggle('active', player.headInWater)
  updateOxygen()
  if (player.oxygen < 90 && player.headInWater) underwaterOverlay.classList.add('danger')
  else underwaterOverlay.classList.remove('danger')
}

function onResize() {
  const width = window.innerWidth
  const height = window.innerHeight
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouch ? 1.5 : 2))
  renderer.setSize(width, height, false)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  handCamera.aspect = width / height
  handCamera.updateProjectionMatrix()
}
window.addEventListener('resize', onResize)

// ---------------------------------------------------------------- boot
async function boot() {
  loadingText.textContent = 'Carving rivers and ridgelines…'
  loadingBar.style.width = '24%'
  await new Promise((resolve) => setTimeout(resolve, 40))
  const spawnChunkX = Math.floor(spawn.x / 16)
  const spawnChunkZ = Math.floor(spawn.z / 16)
  world.ensureArea(spawnChunkX, spawnChunkZ, world.renderDistance)

  loadingText.textContent = 'Planting the last oak…'
  loadingBar.style.width = '78%'
  await new Promise((resolve) => setTimeout(resolve, 20))

  player = new Player({ world, scene, camera, spawn, audio, effects })
  critters = new Critters(scene, world, spawn)
  player.look(0, 0)
  const focus = new THREE.Vector3(-11, spawn.y + 5, -33)
  player.yaw = Math.atan2(-(focus.x - spawn.x), -(focus.z - spawn.z))
  player.pitch = -0.075
  player.updateCamera(0.016)
  player.selected = HOTBAR[0]
  player.onDeath = () => {
    deathReason.textContent = lastDamageCause === 'drown' ? 'The water pulled you under.' : lastDamageCause === 'void' ? 'You fell out of the world.' : 'The fall was too far.'
    deathScreen.classList.remove('is-hidden')
    mining = false
    if (document.pointerLockElement) document.exitPointerLock()
  }
  player.onDamage = (amount, cause) => {
    lastDamageCause = cause
    flashDamage()
  }
  player.onHealthChanged = updateHealth
  updateHealth(player.health)
  setSelected(0, false)
  setModeChip()
  window.__mc3d = { world, player, renderer, scene, camera, effects, environment, critters }

  loadingText.textContent = 'Waking the morning…'
  loadingBar.style.width = '100%'
  loading.classList.add('is-hidden')
  startBtn.disabled = false
  requestAnimationFrame(loop)
}

let last = performance.now()
let environmentTime = 0
let physicsAccumulator = 0
const FIXED_STEP = 1 / 60

function loop(now) {
  requestAnimationFrame(loop)
  const dt = Math.min(0.2, Math.max(0.001, (now - last) / 1000))
  last = now
  environmentTime = environment.update(player ? player.getEyePosition().clone() : camera.position)

  const active = started && !paused && !player.dead && !document.hidden
  if (player && active) {
    physicsAccumulator = Math.min(physicsAccumulator + dt, 0.18)
    let steps = 0
    while (physicsAccumulator >= FIXED_STEP && steps < 12) {
      player.update(FIXED_STEP)
      player.updateMining(FIXED_STEP, true, mining, () => {})
      physicsAccumulator -= FIXED_STEP
      steps++
    }
    if (player.inWater !== underwaterOverlay.classList.contains('active')) {
      underwaterOverlay.classList.toggle('active', player.inWater)
    }
  } else if (player) {
    physicsAccumulator = 0
    player.highlight.visible = false
    player.crackMesh.visible = false
    player.updateCamera(dt)
  }

  if (player) world.update(player.position)
  if (critters) critters.update(Math.min(dt, 0.05), environmentTime)
  effects.update(Math.min(dt, 0.05))
  updateHeldItem(Math.min(dt, 0.05))
  updateHud(now)

  renderer.clear()
  renderer.render(scene, camera)
  if (started && !paused && !player?.dead) {
    renderer.clearDepth()
    renderer.render(handScene, handCamera)
  }
}

function updateHeldItem(dt) {
  const bob = player ? player.bob : 0
  const idle = Math.sin(environmentTime * 1.6) * 0.008
  let lift = 0
  let tilt = 0
  let roll = 0
  if (swingRemaining > 0) {
    swingRemaining = Math.max(0, swingRemaining - dt)
    const t = 1 - swingRemaining / 0.3
    const arc = Math.sin(t * Math.PI)
    lift = arc * 0.12
    tilt = arc * -0.5
    roll = arc * 0.18
  }
  const handX = Math.max(0.17, Math.min(0.66, handCamera.aspect * 0.38))
  const handScale = Math.max(0.54, Math.min(1, handCamera.aspect / 1.15))
  heldRoot.scale.setScalar(handScale)
  heldRoot.position.set(handX, -0.46 + bob * 1.4 + idle + lift, -1.55)
  heldRoot.rotation.set(0.12 + tilt, -0.58, 0.12 + roll)
}

startBtn.disabled = true
boot().catch((error) => {
  console.error(error)
  loadingText.textContent = 'The world failed to load. Reload to try again.'
})
