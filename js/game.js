import * as THREE from '../vendor/three.module.min.js';
import { createWorld } from './world.js';
import { createWeapons } from './weapons.js';
import { CombatAudio } from './audio.js';

/* ============================================================
   BROKEN LINE — tactical wave-survival FPS
   ============================================================ */

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, lambda, dt) => THREE.MathUtils.damp(a, b, lambda, dt);
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const choose = (arr) => arr[Math.floor(Math.random() * arr.length)];
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const pad = (n, len = 2) => String(n).padStart(len, '0');
const IS_TOUCH = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const TOTAL_WAVES = 6;

const DIFFICULTIES = {
  recruit: {
    label: 'RECRUIT',
    health: 82,
    damage: 2.6,
    accuracy: 0.18,
    speed: 0.88,
    desc: 'Forgiving hostile accuracy and lighter armor. A clean first deployment.',
  },
  regular: {
    label: 'REGULAR',
    health: 104,
    damage: 3.6,
    accuracy: 0.26,
    speed: 0.96,
    desc: 'Standard hostile accuracy and armor. The intended experience.',
  },
  veteran: {
    label: 'VETERAN',
    health: 132,
    damage: 5.2,
    accuracy: 0.38,
    speed: 1.06,
    desc: 'Heavier armor and sharper aim. Every piece of cover matters.',
  },
};

const ENEMY_CALLSIGNS = [
  'VIPER-2', 'RAVEN-6', 'KESTREL', 'HOUND-1', 'MANTIS', 'JACKAL-4',
  'SIERRA-3', 'WRAITH', 'LYNX-9', 'TALON', 'COBRA-7', 'ORCA',
  'GHOST-5', 'RIPPER', 'SHRIKE', 'WOLF-3', 'ATLAS', 'DAGGER-2',
];

const WAVE_DATA = [
  { count: 4, title: 'CONTACT', sub: 'Hostiles probing the perimeter' },
  { count: 5, title: 'PRESSURE', sub: 'Multiple contacts closing on the relay' },
  { count: 7, title: 'ENCIRCLED', sub: 'Enemy squads flanking from the east' },
  { count: 8, title: 'BREACH', sub: 'Heavy assault element inbound' },
  { count: 10, title: 'OVERRUN', sub: 'The sector is about to collapse' },
  { count: 8, title: 'JUGGERNAUT', sub: 'Armored heavy closing. Finish it.' },
];

const ui = {
  hud: $('hud'),
  menu: $('menu'),
  manual: $('manual'),
  pause: $('pause'),
  end: $('end'),
  loader: $('loader'),
  loaderBar: $('loaderBar'),
  loaderPct: $('loaderPct'),
  loaderStatus: $('loaderStatus'),
  missionTimer: $('missionTimer'),
  compassTrack: $('compassTrack'),
  compassDeg: $('compassDeg'),
  threatLevel: $('threatLevel'),
  objectiveTitle: $('objectiveTitle'),
  objectiveSub: $('objectiveSub'),
  hostileCount: $('hostileCount'),
  wavePips: $('wavePips'),
  healthValue: $('healthValue'),
  healthBar: $('healthBar'),
  healthBlock: document.querySelector('.health-block'),
  healthStatus: $('healthStatus'),
  grenadeCount: $('grenadeCount'),
  reloadHint: $('reloadHint'),
  weaponName: $('weaponName'),
  weaponClass: $('weaponClass'),
  fireMode: $('fireMode'),
  ammoMag: $('ammoMag'),
  ammoReserve: $('ammoReserve'),
  ammoBars: $('ammoBars'),
  reloadState: $('reloadState'),
  crosshair: $('crosshair'),
  hitmarker: $('hitmarker'),
  killmarker: $('killmarker'),
  damageDir: $('damageDir'),
  damageWash: $('damageWash'),
  lowHealth: $('lowHealth'),
  waveBanner: $('waveBanner'),
  bannerEyebrow: $('bannerEyebrow'),
  bannerTitle: $('bannerTitle'),
  bannerSub: $('bannerSub'),
  killfeed: $('killfeed'),
  feedEmpty: $('feedEmpty'),
  radioLog: $('radioLog'),
  subtitle: $('subtitle'),
  prompt: $('prompt'),
  scoreFloat: $('scoreFloat'),
  hurtFlash: $('hurtFlash'),
  minimap: $('minimap'),
  minimapCoords: $('minimapCoords'),
  toast: $('toast'),
  lockHint: $('lockHint'),
  touchControls: $('touchControls'),
  rotateHint: $('rotateHint'),
  pauseWave: $('pauseWave'),
  pauseKills: $('pauseKills'),
  pauseAccuracy: $('pauseAccuracy'),
  pauseScore: $('pauseScore'),
  sensRange: $('sensRange'),
  sensValue: $('sensValue'),
  invertToggle: $('invertToggle'),
  soundToggle: $('soundToggle'),
  bestWave: $('bestWave'),
  bestKills: $('bestKills'),
  difficultyDesc: $('difficultyDesc'),
  endStatus: $('endStatus'),
  endTitle: $('endTitle'),
  endDesc: $('endDesc'),
  endWaves: $('endWaves'),
  endKills: $('endKills'),
  endAccuracy: $('endAccuracy'),
  endHeads: $('endHeads'),
  endTime: $('endTime'),
  endScore: $('endScore'),
};

// ---------------------------------------------------------------- SETTINGS
function loadSettings() {
  const fallback = { sensitivity: 1, invertY: false, muted: false, difficulty: 'regular', bestWave: 0, bestKills: 0 };
  try {
    const saved = JSON.parse(localStorage.getItem('brokenline.settings') || '{}');
    return { ...fallback, ...saved };
  } catch {
    return fallback;
  }
}
const settings = loadSettings();
function saveSettings() {
  try {
    localStorage.setItem('brokenline.settings', JSON.stringify(settings));
  } catch { /* storage can be unavailable */ }
}

// ---------------------------------------------------------------- CORE
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
  alpha: false,
  stencil: false,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, IS_TOUCH ? 1.35 : 1.6));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.45;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x12191c, 0.0135);
const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.025, 260);
camera.rotation.order = 'YXZ';
scene.add(camera);

// A soft personal fill keeps the weapon and nearby cover readable without
// flattening the scene the way a full-strength global light would.
scene.add(new THREE.AmbientLight(0x7790a0, 0.5));
const playerFill = new THREE.PointLight(0xcfe0e8, IS_TOUCH ? 9 : 15, 26, 1.7);
playerFill.position.set(0.12, 0.32, 0.15);
camera.add(playerFill);

const world = createWorld(scene, renderer, { lowPower: IS_TOUCH });
const weaponSystem = createWeapons(camera);
weaponSystem.root.visible = false;
weaponSystem.root.traverse((obj) => {
  obj.frustumCulled = false;
});

const audio = new CombatAudio();
audio.muted = settings.muted;

// Global game state
const game = {
  mode: 'menu', // menu | playing | paused | end
  phase: 'idle', // idle | prep | active | intermission | extract | dead
  started: false,
  wave: 0,
  waveTimer: 0,
  spawnQueue: [],
  spawnTimer: 0,
  interTimer: 0,
  missionTime: 0,
  deathTimer: 0,
  difficulty: settings.difficulty in DIFFICULTIES ? settings.difficulty : 'regular',
  health: 100,
  maxHealth: 100,
  lastDamage: 99,
  grenades: 2,
  maxGrenades: 2,
  kills: 0,
  headshots: 0,
  shots: 0,
  hits: 0,
  score: 0,
  wavesCleared: 0,
  hudRefresh: 0,
  minimapRefresh: 0,
  bestWave: settings.bestWave,
  bestKills: settings.bestKills,
  combo: 0,
  comboTimer: 0,
  introT: 0,
};

const player = {
  pos: new THREE.Vector3(0, 0, 20),
  y: 0,
  vel: new THREE.Vector3(),
  yaw: 0,
  pitch: -0.015,
  recoilYaw: 0,
  recoilPitch: 0,
  grounded: true,
  jumpVel: 0,
  speed: 0,
  sprinting: false,
  aiming: false,
  radius: 0.34,
  eye: 1.68,
  bobTime: 0,
  bob: 0,
  stepTimer: 0,
  swayX: 0,
  swayY: 0,
  mouseDX: 0,
  mouseDY: 0,
  shake: 0,
  deadTilt: 0,
  usingTouch: IS_TOUCH,
};

const weaponState = {
  current: weaponSystem.weapons.rifle,
  id: 'rifle',
  ads: 0,
  reloading: false,
  reloadTimer: 0,
  reloadDuration: 0,
  nextFire: 0,
  triggerHeld: false,
  triggerPressed: false,
  triggerReleased: true,
  kick: 0,
  kickYaw: 0,
  switchTimer: 0,
  raise: 0,
  barrelSmoke: 0,
  knifeTimer: 0,
  swayTargetX: 0,
  swayTargetY: 0,
};

const input = {
  forward: 0,
  strafe: 0,
  jump: false,
  fire: false,
  aim: false,
  reload: false,
  sprint: false,
  touchMoveX: 0,
  touchMoveY: 0,
};

const keys = new Set();
const tmpVec = new THREE.Vector3();
const tmpVec2 = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();
const raycaster = new THREE.Raycaster();
raycaster.far = 160;

// ---------------------------------------------------------------- UTILITIES
function textureFromCanvas(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const glowTexture = textureFromCanvas(128, (ctx, s) => {
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.18, 'rgba(255,255,255,0.65)');
  g.addColorStop(0.52, 'rgba(255,255,255,0.14)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
});

function collidesCircle(x, z, r) {
  for (const c of world.colliders) {
    if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) return true;
  }
  return false;
}

function isVisibleFrom(origin, target) {
  tmpVec.copy(target).sub(origin);
  const dist = tmpVec.length();
  if (dist < 0.05) return true;
  tmpVec.normalize();
  raycaster.set(origin, tmpVec);
  raycaster.far = dist - 0.12;
  const hits = raycaster.intersectObjects(world.occluders, false);
  raycaster.far = 160;
  return hits.length === 0;
}

function disposeGroup(group) {
  group.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose?.();
    if (obj.material) {
      if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose?.());
      else obj.material.dispose?.();
    }
  });
  group.parent?.remove(group);
}

// ---------------------------------------------------------------- PARTICLES
const particleTexture = textureFromCanvas(64, (ctx, s) => {
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
});

class ParticlePool {
  constructor(count, additive = false) {
    this.items = [];
    this.cursor = 0;
    for (let i = 0; i < count; i++) {
      const material = new THREE.SpriteMaterial({
        map: particleTexture,
        color: 0xffffff,
        transparent: true,
        opacity: 1,
        depthWrite: false,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      });
      const sprite = new THREE.Sprite(material);
      sprite.visible = false;
      sprite.frustumCulled = false;
      scene.add(sprite);
      this.items.push({ sprite, material, vel: new THREE.Vector3(), life: 0, maxLife: 1, size: 0.1, gravity: 0, drag: 0.98 });
    }
  }
  spawn(position, velocity, color, size, life, gravity = 4, drag = 0.97) {
    const item = this.items[this.cursor++ % this.items.length];
    item.sprite.visible = true;
    item.sprite.position.copy(position);
    item.vel.copy(velocity);
    item.material.color.set(color);
    item.material.opacity = 1;
    item.material.rotation = Math.random() * Math.PI * 2;
    item.sprite.scale.set(size, size, 1);
    item.life = life;
    item.maxLife = life;
    item.size = size;
    item.gravity = gravity;
    item.drag = drag;
    return item;
  }
  update(dt) {
    for (const item of this.items) {
      if (item.life <= 0) continue;
      item.life -= dt;
      if (item.life <= 0) {
        item.sprite.visible = false;
        continue;
      }
      item.vel.y -= item.gravity * dt;
      item.vel.multiplyScalar(Math.pow(item.drag, dt * 60));
      item.sprite.position.addScaledVector(item.vel, dt);
      const p = item.life / item.maxLife;
      item.material.opacity = p * p * 0.92;
      const grow = 1 + (1 - p) * 1.8;
      item.sprite.scale.set(item.size * grow, item.size * grow, 1);
    }
  }
  clear() {
    for (const item of this.items) {
      item.life = 0;
      item.sprite.visible = false;
    }
  }
}

const dustParticles = new ParticlePool(110, false);
const sparkParticles = new ParticlePool(90, true);
const bloodParticles = new ParticlePool(80, false);

// ---------------------------------------------------------------- TRACERS
class TracerPool {
  constructor(count) {
    this.items = [];
    this.cursor = 0;
    const positions = new Float32Array(6);
    for (let i = 0; i < count; i++) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions.slice(), 3));
      const material = new THREE.LineBasicMaterial({
        color: 0xffd9a0,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const line = new THREE.Line(geometry, material);
      line.visible = false;
      line.frustumCulled = false;
      scene.add(line);
      this.items.push({ line, material, life: 0, maxLife: 0.06 });
    }
  }
  spawn(start, end, color = 0xffd6a0, life = 0.065) {
    const item = this.items[this.cursor++ % this.items.length];
    const pos = item.line.geometry.attributes.position;
    pos.setXYZ(0, start.x, start.y, start.z);
    pos.setXYZ(1, end.x, end.y, end.z);
    pos.needsUpdate = true;
    item.line.visible = true;
    item.material.color.set(color);
    item.material.opacity = 0.82;
    item.life = life;
    item.maxLife = life;
  }
  update(dt) {
    for (const item of this.items) {
      if (item.life <= 0) continue;
      item.life -= dt;
      if (item.life <= 0) {
        item.line.visible = false;
        item.material.opacity = 0;
      } else {
        item.material.opacity = Math.max(0, item.life / item.maxLife) * 0.82;
      }
    }
  }
  clear() {
    this.items.forEach((item) => {
      item.life = 0;
      item.line.visible = false;
    });
  }
}
const tracers = new TracerPool(70);

// Bullet-hole decals
const decalGeometry = new THREE.CircleGeometry(0.052, 7);
const decalMaterial = new THREE.MeshBasicMaterial({ color: 0x070908, polygonOffset: true, polygonOffsetFactor: -4, side: THREE.DoubleSide });
const decals = [];
for (let i = 0; i < 80; i++) {
  const mesh = new THREE.Mesh(decalGeometry, decalMaterial);
  mesh.visible = false;
  mesh.renderOrder = 2;
  scene.add(mesh);
  decals.push(mesh);
}
let decalCursor = 0;
function addDecal(point, normal) {
  const mesh = decals[decalCursor++ % decals.length];
  mesh.position.copy(point).addScaledVector(normal, 0.012);
  mesh.lookAt(tmpVec.copy(point).add(normal));
  mesh.rotateZ(Math.random() * Math.PI);
  mesh.visible = true;
}

// Shockwave / explosion flash pool
const shockwaves = [];
for (let i = 0; i < 5; i++) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(1, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0xffc06a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  mesh.visible = false;
  scene.add(mesh);
  shockwaves.push({ mesh, life: 0, maxLife: 0.5, startScale: 0.5, endScale: 5 });
}
let shockCursor = 0;
function spawnShockwave(pos, color = 0xffb15a, maxScale = 6) {
  const s = shockwaves[shockCursor++ % shockwaves.length];
  s.mesh.position.copy(pos);
  s.mesh.scale.setScalar(0.35);
  s.mesh.material.color.set(color);
  s.mesh.material.opacity = 0.55;
  s.mesh.visible = true;
  s.life = 0.5;
  s.maxLife = 0.5;
  s.endScale = maxScale;
}
function updateShockwaves(dt) {
  for (const s of shockwaves) {
    if (s.life <= 0) continue;
    s.life -= dt;
    if (s.life <= 0) {
      s.mesh.visible = false;
      continue;
    }
    const p = 1 - s.life / s.maxLife;
    s.mesh.scale.setScalar(0.35 + p * s.endScale);
    s.mesh.material.opacity = (1 - p) * 0.4;
  }
}

// Explosion lights
const explosionLights = [];
for (let i = 0; i < 2; i++) {
  const light = new THREE.PointLight(0xffa04f, 0, 24, 1.6);
  scene.add(light);
  explosionLights.push({ light, life: 0 });
}
let explosionLightCursor = 0;

// Runtime collections populated later in the file.
let enemies = [];
let enemyHitMeshes = [];
let pickups = [];
let grenades = [];
let bannerTimeout = 0;
let subtitleTimeout = 0;
let toastTimeout = 0;
let feedTimers = [];
let radioTimers = [];

// ---------------------------------------------------------------- HUD HELPERS
function refreshBestStats() {
  ui.bestWave.textContent = pad(game.bestWave);
  ui.bestKills.textContent = pad(game.bestKills, 3);
}

function buildCompass() {
  ui.compassTrack.innerHTML = '';
  const labels = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
  for (let deg = 0; deg < 360; deg += 5) {
    const mark = document.createElement('span');
    mark.className = 'compass-mark';
    if (labels[deg]) {
      mark.classList.add('major');
      mark.textContent = labels[deg];
    } else if (deg % 15 === 0) {
      mark.classList.add('tick');
    } else {
      mark.classList.add('tick');
      mark.style.opacity = '0.45';
    }
    mark.dataset.deg = deg;
    ui.compassTrack.appendChild(mark);
  }
}

function buildWavePips() {
  ui.wavePips.innerHTML = '';
  for (let i = 0; i < TOTAL_WAVES; i++) {
    const pip = document.createElement('span');
    pip.className = 'wave-pip';
    ui.wavePips.appendChild(pip);
  }
}

function updateCompass() {
  const heading = ((-THREE.MathUtils.radToDeg(player.yaw) % 360) + 360) % 360;
  for (const mark of ui.compassTrack.children) {
    const deg = Number(mark.dataset.deg);
    let rel = ((deg - heading + 540) % 360) - 180;
    mark.style.left = `${rel * 2.55}px`;
    mark.style.opacity = Math.abs(rel) > 82 ? '0' : '';
  }
  ui.compassDeg.textContent = pad(Math.round(heading) % 360, 3);
}

function buildAmmoBars() {
  ui.ammoBars.innerHTML = '';
  for (let i = 0; i < 10; i++) {
    const bar = document.createElement('i');
    bar.className = 'ammo-bar';
    ui.ammoBars.appendChild(bar);
  }
}

function updateWeaponHud() {
  const w = weaponState.current;
  ui.weaponName.textContent = w.name;
  ui.weaponClass.textContent = w.className;
  ui.fireMode.textContent = w.fireMode;
  updateAmmoHud();
}

function updateAmmoHud() {
  const w = weaponState.current;
  ui.ammoMag.textContent = pad(w.ammo);
  ui.ammoReserve.textContent = pad(w.reserve, 3);
  ui.ammoMag.parentElement.classList.toggle('empty', w.ammo === 0);
  const ratio = w.ammo / w.magSize;
  const on = Math.ceil(ratio * 10);
  [...ui.ammoBars.children].forEach((bar, i) => {
    bar.classList.toggle('on', i < on && ratio > 0);
    bar.classList.toggle('low', i < on && ratio > 0 && ratio <= 0.3);
  });
  ui.reloadHint.classList.toggle('warn', w.ammo <= Math.ceil(w.magSize * 0.25));
  ui.reloadHint.classList.toggle('dim', w.ammo > Math.ceil(w.magSize * 0.25));
  if (weaponState.reloading) {
    ui.reloadState.textContent = 'RELOADING';
  } else if (w.ammo === 0) {
    ui.reloadState.textContent = 'MAG EMPTY';
  } else {
    ui.reloadState.textContent = '';
  }
}

function updateHealthHud() {
  const pct = clamp(game.health / game.maxHealth, 0, 1);
  ui.healthValue.textContent = String(Math.ceil(game.health));
  ui.healthBar.style.width = `${pct * 100}%`;
  ui.healthBlock.classList.toggle('low', pct <= 0.34);
  ui.healthStatus.textContent = pct <= 0.34 ? 'CRITICAL CONDITION' : game.lastDamage < 5 ? 'UNDER FIRE' : 'COMBAT READY';
  ui.lowHealth.classList.toggle('show', pct <= 0.28 && game.health > 0);
}

function updateGrenadeHud() {
  ui.grenadeCount.textContent = game.grenades;
}

function setObjective(title, sub, count) {
  if (ui.objectiveTitle.textContent !== title) ui.objectiveTitle.textContent = title;
  if (ui.objectiveSub.textContent !== sub) ui.objectiveSub.textContent = sub;
  ui.hostileCount.textContent = count;
}

function updateWavePips() {
  [...ui.wavePips.children].forEach((pip, i) => {
    pip.classList.toggle('active', i + 1 === game.wave && (game.phase === 'active' || game.phase === 'prep'));
    pip.classList.toggle('done', i + 1 < game.wave || (game.phase === 'extract' && i + 1 <= game.wave));
  });
}

function showBanner(eyebrow, title, sub, duration = 3200) {
  ui.bannerEyebrow.textContent = eyebrow;
  ui.bannerTitle.textContent = title;
  ui.bannerSub.textContent = sub;
  ui.waveBanner.classList.add('show');
  clearTimeout(bannerTimeout);
  bannerTimeout = setTimeout(() => ui.waveBanner.classList.remove('show'), duration);
}

function showSubtitle(text, duration = 3000) {
  ui.subtitle.innerHTML = text;
  ui.subtitle.classList.add('show');
  clearTimeout(subtitleTimeout);
  subtitleTimeout = setTimeout(() => ui.subtitle.classList.remove('show'), duration);
}

function showToast(text, duration = 2100) {
  ui.toast.textContent = text;
  ui.toast.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => ui.toast.classList.remove('show'), duration);
}

function radioLine(text, speaker = 'OVERWATCH') {
  const line = document.createElement('div');
  line.className = 'radio-line';
  line.innerHTML = `<b>${speaker}</b>${text}`;
  ui.radioLog.prepend(line);
  while (ui.radioLog.children.length > 3) ui.radioLog.lastElementChild.remove();
  const timer = setTimeout(() => {
    line.style.opacity = '0';
    line.style.transition = 'opacity .4s ease';
    setTimeout(() => line.remove(), 420);
  }, 5200);
  radioTimers.push(timer);
}

function addKillfeed(name, headshot = false, heavy = false) {
  const item = document.createElement('div');
  item.className = 'feed-item';
  item.innerHTML = `<span class="feed-self">YOU</span><span class="feed-weapon">[${headshot ? 'HEADSHOT' : 'M4'}]</span><i class="skull"></i><span class="${heavy ? 'feed-bad' : ''}">${name}</span>`;
  ui.killfeed.prepend(item);
  ui.feedEmpty.style.opacity = '0';
  while (ui.killfeed.children.length > 5) ui.killfeed.lastElementChild.remove();
  const timer = setTimeout(() => {
    item.classList.add('out');
    setTimeout(() => {
      item.remove();
      if (!ui.killfeed.children.length) ui.feedEmpty.style.opacity = '1';
    }, 320);
  }, 4800);
  feedTimers.push(timer);
}

function showHitmarker(headshot = false) {
  const el = ui.hitmarker;
  el.classList.remove('show', 'headshot');
  void el.offsetWidth;
  if (headshot) el.classList.add('headshot');
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show', 'headshot'), 190);
}

function showKillmarker() {
  const el = ui.killmarker;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), 400);
}

function showScore(points, label = 'ELIMINATION') {
  ui.scoreFloat.innerHTML = `<b>+${points}</b><span>${label}</span>`;
  ui.scoreFloat.classList.remove('show');
  void ui.scoreFloat.offsetWidth;
  ui.scoreFloat.classList.add('show');
  clearTimeout(ui.scoreFloat._timer);
  ui.scoreFloat._timer = setTimeout(() => ui.scoreFloat.classList.remove('show'), 1150);
}

function showDamageDirection(source) {
  const dx = source.x - player.pos.x;
  const dz = source.z - player.pos.z;
  const forwardX = -Math.sin(player.yaw);
  const forwardZ = -Math.cos(player.yaw);
  const rightX = Math.cos(player.yaw);
  const rightZ = -Math.sin(player.yaw);
  const fDot = dx * forwardX + dz * forwardZ;
  const rDot = dx * rightX + dz * rightZ;
  const angle = Math.atan2(rDot, fDot) * 180 / Math.PI;
  ui.damageDir.style.transform = `rotate(${angle}deg)`;
  ui.damageDir.style.opacity = '1';
  clearTimeout(ui.damageDir._timer);
  ui.damageDir._timer = setTimeout(() => {
    ui.damageDir.style.opacity = '0';
  }, 300);

  ui.hurtFlash.classList.remove('on');
  void ui.hurtFlash.offsetWidth;
  ui.hurtFlash.classList.add('on');
}

function clearCombatText() {
  ui.killfeed.innerHTML = '';
  ui.radioLog.innerHTML = '';
  ui.feedEmpty.style.opacity = '1';
  ui.waveBanner.classList.remove('show');
  ui.subtitle.classList.remove('show');
  ui.toast.classList.remove('show');
  clearTimeout(bannerTimeout);
  clearTimeout(subtitleTimeout);
  clearTimeout(toastTimeout);
  feedTimers.forEach(clearTimeout);
  radioTimers.forEach(clearTimeout);
  feedTimers = [];
  radioTimers = [];
}

// ---------------------------------------------------------------- EFFECTS
function spawnImpact(point, normal, surface = 'world') {
  for (let i = 0; i < 3; i++) {
    dustParticles.spawn(
      point,
      new THREE.Vector3(rand(-0.7, 0.7), rand(0.2, 1.2), rand(-0.7, 0.7)).addScaledVector(normal, rand(0.2, 1)),
      surface === 'metal' ? 0xc4b89b : 0x8a8775,
      rand(0.06, 0.13),
      rand(0.25, 0.55),
      3.5,
      0.94
    );
  }
  for (let i = 0; i < 4; i++) {
    sparkParticles.spawn(
      point,
      new THREE.Vector3(rand(-2.5, 2.5), rand(0.5, 3.2), rand(-2.5, 2.5)).addScaledVector(normal, rand(0.3, 2.2)),
      0xffb75f,
      rand(0.018, 0.04),
      rand(0.12, 0.28),
      7,
      0.99
    );
  }
  if (surface === 'world') addDecal(point, normal);
}

function spawnBlood(point, dir) {
  for (let i = 0; i < 7; i++) {
    bloodParticles.spawn(
      point,
      new THREE.Vector3(rand(-1.4, 1.4), rand(-0.3, 1.6), rand(-1.4, 1.4)).addScaledVector(dir, rand(0.3, 2)),
      0x55120f,
      rand(0.04, 0.1),
      rand(0.2, 0.45),
      5,
      0.93
    );
  }
  dustParticles.spawn(point, new THREE.Vector3(0, 0.45, 0), 0x6f342a, 0.15, 0.28, 0.8, 0.95);
}

function spawnMuzzleSmoke(position, direction) {
  dustParticles.spawn(
    position,
    direction.clone().multiplyScalar(0.6).add(new THREE.Vector3(rand(-0.15, 0.15), rand(0.1, 0.45), rand(-0.15, 0.15))),
    0x9b9b91,
    rand(0.05, 0.1),
    rand(0.35, 0.6),
    -0.4,
    0.96
  );
}

function spawnShell(position, side) {
  const velocity = side.clone().multiplyScalar(rand(2.2, 3.4)).add(new THREE.Vector3(rand(-0.4, 0.4), rand(1.2, 2.2), rand(-0.4, 0.4)));
  sparkParticles.spawn(position, velocity, 0xd4ad62, 0.03, 0.55, 9, 0.985);
}

function spawnPickupDust(position) {
  dustParticles.spawn(position, new THREE.Vector3(0, 0.5, 0), 0x7ddb8b, 0.12, 0.3, 0.5, 0.94);
}

// ---------------------------------------------------------------- WEAPON FLOW
function canShoot() {
  return game.mode === 'playing'
    && game.phase !== 'dead'
    && game.phase !== 'idle'
    && !weaponState.reloading
    && weaponState.switchTimer <= 0
    && game.health > 0;
}

function beginReload(silent = false) {
  const w = weaponState.current;
  if (weaponState.reloading || w.ammo >= w.magSize || w.reserve <= 0 || game.phase === 'dead') return;
  weaponState.reloading = true;
  weaponState.reloadDuration = w.reloadTime;
  weaponState.reloadTimer = w.reloadTime;
  weaponState.triggerHeld = false;
  audio.reloadStart();
  updateAmmoHud();
  if (!silent) showSubtitle('RELOADING', 900);
}

function finishReload() {
  const w = weaponState.current;
  const needed = w.magSize - w.ammo;
  const take = Math.min(needed, w.reserve);
  w.ammo += take;
  w.reserve -= take;
  weaponState.reloading = false;
  weaponState.reloadTimer = 0;
  audio.reloadEnd();
  updateAmmoHud();
}

function switchWeapon(id) {
  if (game.mode !== 'playing' || game.phase === 'dead' || weaponState.switchTimer > 0) return;
  if (weaponState.id === id) return;
  weaponState.id = id;
  weaponState.current = weaponSystem.weapons[id];
  weaponSystem.show(id);
  weaponState.reloading = false;
  weaponState.reloadTimer = 0;
  weaponState.switchTimer = 0.44;
  weaponState.ads = 0;
  weaponState.kick = 0;
  audio.switchWeapon();
  updateWeaponHud();
}

function doMelee() {
  if (game.mode !== 'playing' || game.phase === 'dead' || weaponState.knifeTimer > 0) return;
  weaponState.knifeTimer = 0.45;
  audio.melee();
  player.shake = Math.max(player.shake, 0.3);
  const origin = camera.position.clone();
  const dir = camera.getWorldDirection(new THREE.Vector3());
  let best = null;
  let bestDist = 2.9;
  for (const e of enemies) {
    if (e.dead) continue;
    const d = e.group.position.distanceTo(origin);
    if (d > bestDist) continue;
    const to = e.group.position.clone().setY(origin.y).sub(origin).normalize();
    if (dir.dot(to) > 0.62) {
      best = e;
      bestDist = d;
    }
  }
  if (best) {
    const head = Math.random() > 0.4;
    damageEnemy(best, 250, head ? 'head' : 'body', best.group.position.clone().setY(1.2), 'MELEE');
    spawnBlood(best.group.position.clone().setY(1.2), dir);
  }
}

function fireWeapon() {
  if (!canShoot()) return;
  const w = weaponState.current;
  const now = performance.now() / 1000;
  if (now < weaponState.nextFire) return;
  if (!w.auto && !weaponState.triggerPressed) return;
  if (w.ammo <= 0) {
    if (weaponState.triggerPressed) {
      audio.dryFire();
      beginReload(true);
    }
    return;
  }

  w.ammo--;
  game.shots++;
  weaponState.nextFire = now + 60 / w.rpm;
  weaponState.triggerPressed = false;
  weaponState.triggerHeld = w.auto ? weaponState.triggerHeld : false;

  weaponState.kick = 1;
  weaponState.kickYaw = rand(-1, 1);
  player.recoilPitch += w.recoil * rand(0.62, 1.1);
  player.recoilYaw += w.recoilYaw * rand(-1, 1);
  player.shake = Math.max(player.shake, 0.1);
  audio[w.sound === 'rifle' ? 'rifleShot' : 'pistolShot'](0);

  weaponSystem.triggerFlash(w);
  const muzzleWorld = w.muzzle.getWorldPosition(new THREE.Vector3());
  const forward = camera.getWorldDirection(new THREE.Vector3());
  spawnMuzzleSmoke(muzzleWorld, forward);
  const camRight = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
  spawnShell(muzzleWorld.clone().addScaledVector(camRight, 0.04), camRight);

  // Spread comes from the weapon, movement, and sustained fire.
  const moveFactor = clamp(player.speed / 7, 0, 1);
  const spread = (weaponState.ads > 0.55 ? w.adsSpread : w.hipSpread) + moveFactor * 0.0045 + (1 - weaponState.ads) * 0.0025;
  const radius = spread * Math.sqrt(Math.random());
  const angle = Math.random() * Math.PI * 2;
  const ndc = { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };

  camera.updateMatrixWorld(true);
  raycaster.setFromCamera(ndc, camera);
  raycaster.far = 160;
  const hits = raycaster.intersectObjects([...world.occluders, ...enemyHitMeshes], false);
  let hit = null;
  for (const h of hits) {
    const enemy = h.object.userData.enemy;
    if (enemy && enemy.dead) continue;
    hit = h;
    break;
  }

  let end = raycaster.ray.at(120, new THREE.Vector3());
  if (hit) {
    end = hit.point.clone();
    const enemy = hit.object.userData.enemy;
    if (enemy) {
      game.hits++;
      const zone = hit.object.userData.zone || 'body';
      const headshot = zone === 'head';
      if (headshot) game.headshots++;
      const falloff = clamp(1.12 - hit.distance / 150, 0.74, 1);
      const damage = w.damage * (headshot ? w.headMult : zone === 'legs' ? 0.72 : 1) * falloff;
      damageEnemy(enemy, damage, zone, hit.point, w.name);
      spawnBlood(hit.point, forward);
      showHitmarker(headshot);
      audio.hit(headshot);
    } else {
      const normal = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize() : new THREE.Vector3(0, 1, 0);
      const surface = hit.object.material?.metalness > 0.35 ? 'metal' : 'world';
      spawnImpact(hit.point, normal, surface);
    }
  }
  tracers.spawn(muzzleWorld, end, w.tracerColor, 0.07);
  updateAmmoHud();

  if (w.ammo <= 0) {
    setTimeout(() => {
      if (game.mode === 'playing' && weaponState.current === w && !weaponState.reloading) beginReload(true);
    }, 220);
  }
}

function updateWeapon(dt) {
  const w = weaponState.current;
  weaponSystem.updateFlash(w, dt);

  if (weaponState.switchTimer > 0) weaponState.switchTimer = Math.max(0, weaponState.switchTimer - dt);
  if (weaponState.knifeTimer > 0) weaponState.knifeTimer = Math.max(0, weaponState.knifeTimer - dt);

  if (weaponState.reloading) {
    weaponState.reloadTimer -= dt;
    if (weaponState.reloadTimer <= 0) finishReload();
    else if (weaponState.reloadTimer < 0.18) ui.reloadState.textContent = 'READY';
  }

  const wantAim = input.aim && !player.sprinting && game.phase !== 'dead' && weaponState.switchTimer <= 0;
  weaponState.ads = damp(weaponState.ads, wantAim ? 1 : 0, 12, dt);
  const ads = weaponState.ads;

  weaponState.kick = damp(weaponState.kick, 0, 13, dt);
  player.swayX = damp(player.swayX, clamp(-player.mouseDX * 0.00055, -0.03, 0.03), 10, dt);
  player.swayY = damp(player.swayY, clamp(-player.mouseDY * 0.00045, -0.022, 0.022), 10, dt);

  if (!weaponSystem.root.visible) {
    player.mouseDX = 0;
    player.mouseDY = 0;
    return;
  }

  const hip = w.hipPos;
  const adsPos = w.adsPos;
  tmpVec.set(
    lerp(hip.x, adsPos.x, ads),
    lerp(hip.y, adsPos.y, ads),
    lerp(hip.z, adsPos.z, ads)
  );

  if (player.sprinting) {
    const s = clamp(player.speed / 7.5, 0, 1) * (1 - ads);
    tmpVec.lerp(w.sprintPos, s);
  }

  const bobStrength = clamp(player.speed / 6.5, 0, 1) * (player.grounded ? 1 : 0.25) * (1 - ads * 0.72);
  const bobX = Math.sin(player.bobTime) * 0.0075 * bobStrength;
  const bobY = Math.abs(Math.cos(player.bobTime)) * 0.006 * bobStrength;

  let reloadDip = 0;
  let reloadRoll = 0;
  if (weaponState.reloading) {
    const p = clamp(1 - weaponState.reloadTimer / weaponState.reloadDuration, 0, 1);
    reloadDip = Math.sin(p * Math.PI) * 0.075;
    reloadRoll = Math.sin(p * Math.PI) * 0.32;
  }

  const raise = weaponState.switchTimer / 0.44;
  const knife = weaponState.knifeTimer > 0 ? Math.sin((1 - weaponState.knifeTimer / 0.45) * Math.PI) : 0;

  weaponSystem.root.position.set(
    tmpVec.x + player.swayX + bobX + knife * 0.17,
    tmpVec.y + player.swayY + bobY - reloadDip - raise * 0.32 - knife * 0.22,
    tmpVec.z + weaponState.kick * 0.055
  );

  const hipRotX = lerp(w.hipRot.x, w.adsRot.x, ads);
  const hipRotY = lerp(w.hipRot.y, w.adsRot.y, ads);
  let rotX = hipRotX + weaponState.kick * 0.045 + player.swayY * -1.7 - knife * 0.38;
  let rotY = hipRotY + player.swayX * 1.6 + weaponState.kickYaw * weaponState.kick * 0.02;
  let rotZ = reloadRoll + raise * 0.16 + knife * 0.5;
  if (player.sprinting) {
    rotX += 0.11;
    rotY += 0.45;
    rotZ += 0.15;
  }
  weaponSystem.root.rotation.set(rotX, rotY, rotZ);

  // FOV breathing
  const targetFov = ads > 0.55 ? w.adsFov : player.sprinting ? 80 : 73;
  camera.fov = damp(camera.fov, targetFov, 10, dt);
  camera.updateProjectionMatrix();

  // Crosshair expansion
  const moveFactor = clamp(player.speed / 7, 0, 1);
  const gap = 5 + (1 - ads) * 8 + moveFactor * 5 + weaponState.kick * 4;
  ui.crosshair.style.setProperty('--gap', `${gap.toFixed(1)}px`);
  ui.crosshair.classList.toggle('ads', ads > 0.55 || weaponState.reloading);

  if (weaponState.reloading) ui.reloadState.textContent = 'RELOADING';
  else if (weaponState.current.ammo === 0) ui.reloadState.textContent = 'MAG EMPTY';
  else ui.reloadState.textContent = '';

  player.mouseDX = 0;
  player.mouseDY = 0;
}

// ---------------------------------------------------------------- PLAYER
function doJump() {
  if (!player.grounded || game.phase === 'dead') return;
  player.jumpVel = 5.2;
  player.grounded = false;
  audio.footstep(true);
}

function damagePlayer(amount, source) {
  if (game.mode !== 'playing' || game.phase === 'dead' || game.health <= 0) return;
  game.health = Math.max(0, game.health - amount);
  game.lastDamage = 0;
  player.shake = Math.max(player.shake, clamp(amount / 20, 0.3, 1));
  showDamageDirection(source);
  audio.hurt();
  updateHealthHud();
  if (game.health <= 0) onPlayerDeath();
}

function updatePlayer(dt) {
  if (game.phase === 'dead') {
    player.deadTilt = damp(player.deadTilt, 0.38, 2.2, dt);
    camera.position.set(player.pos.x, damp(camera.position.y, 0.36, 3, dt), player.pos.z);
    camera.rotation.set(damp(camera.rotation.x, -0.16, 3, dt), player.yaw + player.recoilYaw, player.deadTilt, 'YXZ');
    weaponSystem.root.visible = false;
    return;
  }

  let f = 0;
  let s = 0;
  if (keys.has('KeyW')) f += 1;
  if (keys.has('KeyS')) f -= 1;
  if (keys.has('KeyD')) s += 1;
  if (keys.has('KeyA')) s -= 1;
  f += input.touchMoveY;
  s += input.touchMoveX;
  const mag = Math.hypot(f, s);
  if (mag > 1) {
    f /= mag;
    s /= mag;
  }
  const moving = mag > 0.08;

  input.aim = input.aim || keys.has('MouseRight');
  const sprintRequested = (keys.has('ShiftLeft') || keys.has('ShiftRight') || (IS_TOUCH && Math.hypot(input.touchMoveX, input.touchMoveY) > 0.96));
  player.sprinting = sprintRequested && f > 0.15 && !weaponState.reloading && !input.aim && !(weaponState.ads > 0.25);
  const speed = player.sprinting ? 7.2 : input.aim ? 3.2 : 4.7;

  const forwardX = -Math.sin(player.yaw);
  const forwardZ = -Math.cos(player.yaw);
  const rightX = Math.cos(player.yaw);
  const rightZ = -Math.sin(player.yaw);
  const targetVX = (forwardX * f + rightX * s) * speed;
  const targetVZ = (forwardZ * f + rightZ * s) * speed;

  player.vel.x = damp(player.vel.x, targetVX, player.grounded ? 12 : 3.2, dt);
  player.vel.z = damp(player.vel.z, targetVZ, player.grounded ? 12 : 3.2, dt);

  const nx = player.pos.x + player.vel.x * dt;
  if (!collidesCircle(nx, player.pos.z, player.radius)) player.pos.x = nx;
  else player.vel.x *= 0.25;
  const nz = player.pos.z + player.vel.z * dt;
  if (!collidesCircle(player.pos.x, nz, player.radius)) player.pos.z = nz;
  else player.vel.z *= 0.25;

  if (input.jump) {
    doJump();
    input.jump = false;
  }
  if (!player.grounded) {
    player.jumpVel -= 15 * dt;
    player.y += player.jumpVel * dt;
    if (player.y <= 0) {
      player.y = 0;
      player.jumpVel = 0;
      player.grounded = true;
      audio.footstep(false);
    }
  }

  player.speed = Math.hypot(player.vel.x, player.vel.z);
  const moveAmount = player.grounded ? clamp(player.speed / 4.7, 0, 1.65) : 0;
  player.bobTime += dt * (player.sprinting ? 12.5 : 9.2) * clamp(player.speed / 4.7, 0, 1.5);
  player.stepTimer -= dt;
  if (moving && player.grounded && player.stepTimer <= 0 && player.speed > 1) {
    audio.footstep(player.sprinting);
    player.stepTimer = player.sprinting ? 0.31 : 0.46;
  }
  player.bob = Math.sin(player.bobTime) * 0.026 * moveAmount;

  // Regen after five seconds without damage.
  game.lastDamage += dt;
  if (game.lastDamage > 4.6 && game.health > 0 && game.health < game.maxHealth) {
    game.health = Math.min(game.maxHealth, game.health + 14 * dt);
  }

  player.recoilPitch = damp(player.recoilPitch, 0, 8.2, dt);
  player.recoilYaw = damp(player.recoilYaw, 0, 9, dt);
  player.shake = Math.max(0, player.shake - dt * 2.8);

  const bobY = player.bob + (player.sprinting ? Math.abs(Math.sin(player.bobTime * 0.5)) * 0.018 : 0);
  const shakeX = player.shake > 0 ? rand(-1, 1) * player.shake * 0.035 : 0;
  const shakeY = player.shake > 0 ? rand(-1, 1) * player.shake * 0.022 : 0;
  camera.position.set(player.pos.x + shakeX, player.y + player.eye + bobY + shakeY, player.pos.z);
  camera.rotation.set(
    clamp(player.pitch + player.recoilPitch + (player.shake > 0 ? rand(-1, 1) * player.shake * 0.008 : 0), -1.46, 1.46),
    player.yaw + player.recoilYaw,
    player.shake > 0 ? rand(-1, 1) * player.shake * 0.012 : 0,
    'YXZ'
  );

  // Damage edge wash
  const deficit = 1 - game.health / game.maxHealth;
  const recent = clamp(1 - game.lastDamage / 1.3, 0, 1);
  ui.damageWash.style.opacity = String(clamp(deficit * 0.55 + recent * 0.55, 0, 0.85));
}

// ---------------------------------------------------------------- ENEMIES
const enemyGeo = {
  leg: new THREE.BoxGeometry(0.19, 0.8, 0.23),
  boot: new THREE.BoxGeometry(0.22, 0.15, 0.34),
  torso: new THREE.BoxGeometry(0.58, 0.67, 0.33),
  vest: new THREE.BoxGeometry(0.62, 0.47, 0.4),
  head: new THREE.IcosahedronGeometry(0.145, 1),
  helmet: new THREE.BoxGeometry(0.32, 0.13, 0.33),
  arm: new THREE.BoxGeometry(0.135, 0.52, 0.15),
  hand: new THREE.BoxGeometry(0.11, 0.11, 0.12),
  rifle: new THREE.BoxGeometry(0.09, 0.1, 0.52),
  barrel: new THREE.CylinderGeometry(0.017, 0.017, 0.38, 5).rotateX(Math.PI / 2),
  mag: new THREE.BoxGeometry(0.065, 0.17, 0.1),
  pouch: new THREE.BoxGeometry(0.105, 0.12, 0.07),
  shoulder: new THREE.BoxGeometry(0.16, 0.13, 0.23),
  pack: new THREE.BoxGeometry(0.34, 0.42, 0.19),
  plate: new THREE.BoxGeometry(0.32, 0.32, 0.08),
};

const muzzleSpriteTexture = textureFromCanvas(64, (ctx, s) => {
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,247,210,1)');
  g.addColorStop(0.2, 'rgba(255,190,85,0.9)');
  g.addColorStop(0.55, 'rgba(255,95,20,0.2)');
  g.addColorStop(1, 'rgba(255,45,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
});

const enemyFlareTexture = textureFromCanvas(96, (ctx, s) => {
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,78,45,0.95)');
  g.addColorStop(0.2, 'rgba(255,45,20,0.42)');
  g.addColorStop(0.65, 'rgba(255,20,10,0.07)');
  g.addColorStop(1, 'rgba(255,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
});

function buildEnemy(heavy) {
  const uniformColor = heavy ? 0x242923 : new THREE.Color().setHSL(rand(0.23, 0.3), rand(0.08, 0.18), rand(0.16, 0.24)).getHex();
  const uniform = new THREE.MeshStandardMaterial({ color: uniformColor, roughness: 0.9, metalness: 0.04 });
  const armor = new THREE.MeshStandardMaterial({ color: heavy ? 0x151914 : 0x252b24, roughness: 0.7, metalness: 0.2, emissive: 0x000000 });
  const helmetMat = new THREE.MeshStandardMaterial({ color: heavy ? 0x1f241d : 0x30362d, roughness: 0.56, metalness: 0.35 });
  const skin = new THREE.MeshStandardMaterial({ color: 0x8e6b51, roughness: 0.9 });
  const visorMat = new THREE.MeshStandardMaterial({ color: 0x230303, emissive: 0xff311b, emissiveIntensity: 2.4, roughness: 0.3 });
  const boot = new THREE.MeshStandardMaterial({ color: 0x151714, roughness: 0.92 });
  const gunMat = new THREE.MeshStandardMaterial({ color: 0x151a19, roughness: 0.5, metalness: 0.65 });
  const mats = [uniform, armor, helmetMat, skin, visorMat, boot, gunMat];

  const g = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = 0;
  g.add(body);

  const legL = new THREE.Group();
  legL.position.set(-0.16, 0.87, 0);
  const legLMesh = new THREE.Mesh(enemyGeo.leg, uniform);
  legLMesh.position.y = -0.39;
  legLMesh.castShadow = true;
  legL.add(legLMesh);
  const bootL = new THREE.Mesh(enemyGeo.boot, boot);
  bootL.position.set(0, -0.78, 0.06);
  bootL.castShadow = true;
  legL.add(bootL);
  body.add(legL);

  const legR = new THREE.Group();
  legR.position.set(0.16, 0.87, 0);
  const legRMesh = new THREE.Mesh(enemyGeo.leg, uniform);
  legRMesh.position.y = -0.39;
  legRMesh.castShadow = true;
  legR.add(legRMesh);
  const bootR = new THREE.Mesh(enemyGeo.boot, boot);
  bootR.position.set(0, -0.78, 0.06);
  bootR.castShadow = true;
  legR.add(bootR);
  body.add(legR);

  const torso = new THREE.Mesh(enemyGeo.torso, uniform);
  torso.position.set(0, 1.24, 0);
  torso.castShadow = true;
  body.add(torso);

  const vest = new THREE.Mesh(enemyGeo.vest, armor);
  vest.position.set(0, 1.25, 0.018);
  vest.castShadow = true;
  body.add(vest);

  // Chest rig / pouches
  for (let i = -1; i <= 1; i++) {
    const pouch = new THREE.Mesh(enemyGeo.pouch, armor);
    pouch.position.set(i * 0.15, 1.18, 0.235);
    body.add(pouch);
  }
  const shoulderL = new THREE.Mesh(enemyGeo.shoulder, armor);
  shoulderL.position.set(-0.34, 1.47, 0);
  body.add(shoulderL);
  const shoulderR = new THREE.Mesh(enemyGeo.shoulder, armor);
  shoulderR.position.set(0.34, 1.47, 0);
  body.add(shoulderR);

  const pack = new THREE.Mesh(enemyGeo.pack, armor);
  pack.position.set(0, 1.3, -0.23);
  pack.castShadow = true;
  body.add(pack);

  const head = new THREE.Mesh(enemyGeo.head, skin);
  head.position.set(0, 1.72, 0.02);
  head.castShadow = true;
  body.add(head);
  const helmet = new THREE.Mesh(enemyGeo.helmet, helmetMat);
  helmet.position.set(0, 1.82, 0);
  helmet.castShadow = true;
  body.add(helmet);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.05, 0.025), visorMat);
  visor.position.set(0, 1.73, 0.155);
  body.add(visor);
  const faceMask = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.06), armor);
  faceMask.position.set(0, 1.65, 0.13);
  body.add(faceMask);

  // arms (forward grip pose)
  const armL = new THREE.Mesh(enemyGeo.arm, uniform);
  armL.position.set(-0.34, 1.28, 0.17);
  armL.rotation.set(-1.08, 0.2, 0.1);
  armL.castShadow = true;
  body.add(armL);
  const armR = new THREE.Mesh(enemyGeo.arm, uniform);
  armR.position.set(0.3, 1.3, 0.25);
  armR.rotation.set(-1.15, -0.12, -0.1);
  armR.castShadow = true;
  body.add(armR);
  const handL = new THREE.Mesh(enemyGeo.hand, boot);
  handL.position.set(-0.22, 1.31, 0.5);
  body.add(handL);
  const handR = new THREE.Mesh(enemyGeo.hand, boot);
  handR.position.set(0.13, 1.31, 0.53);
  body.add(handR);

  // rifle points along local +Z
  const rifle = new THREE.Group();
  rifle.position.set(0.06, 1.31, 0.31);
  const gunBody = new THREE.Mesh(enemyGeo.rifle, gunMat);
  gunBody.position.z = 0.18;
  rifle.add(gunBody);
  const barrel = new THREE.Mesh(enemyGeo.barrel, gunMat);
  barrel.position.set(0, 0.015, 0.63);
  rifle.add(barrel);
  const gunMag = new THREE.Mesh(enemyGeo.mag, gunMat);
  gunMag.position.set(0, -0.13, 0.17);
  gunMag.rotation.x = 0.18;
  rifle.add(gunMag);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.12, 0.22), gunMat);
  stock.position.set(0, -0.01, -0.12);
  rifle.add(stock);
  body.add(rifle);

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.015, 0.84);
  rifle.add(muzzle);

  const flashMat = new THREE.SpriteMaterial({ map: muzzleSpriteTexture, color: 0xffc175, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const flash = new THREE.Sprite(flashMat);
  flash.position.copy(muzzle.position);
  flash.scale.set(0.55, 0.55, 1);
  flash.visible = false;
  rifle.add(flash);

  const flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: enemyFlareTexture, color: 0xff4028, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }));
  flare.position.set(0.19, 1.48, 0.2);
  flare.scale.set(0.3, 0.3, 1);
  body.add(flare);

  if (heavy) {
    const extraPlate = new THREE.Mesh(enemyGeo.plate, armor);
    extraPlate.position.set(0, 1.25, 0.27);
    extraPlate.castShadow = true;
    body.add(extraPlate);
    const crest = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.3), visorMat);
    crest.position.set(0, 1.93, 0);
    body.add(crest);
    // extra barrel detail for the heavy's weapon
    for (let i = -1; i <= 1; i++) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 5).rotateX(Math.PI / 2), gunMat);
      b.position.set(i * 0.025, 0.015 + i * 0.013, 0.68);
      rifle.add(b);
    }
  }

  const hitList = [
    { mesh: torso, zone: 'body', mult: 1 },
    { mesh: vest, zone: 'body', mult: 1 },
    { mesh: head, zone: 'head', mult: 1 },
    { mesh: helmet, zone: 'head', mult: 1 },
    { mesh: legLMesh, zone: 'legs', mult: 1 },
    { mesh: legRMesh, zone: 'legs', mult: 1 },
  ];

  g.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });

  return { group: g, body, legL, legR, muzzle, flash, flashMat, flare, mats, hitList, torso, head, vest, helmet, uniform, armor };
}

function makeHealthBar(heavy) {
  const group = new THREE.Group();
  const bgMat = new THREE.MeshBasicMaterial({ color: 0x080b0a, transparent: true, opacity: 0.72, depthWrite: false });
  const fillMat = new THREE.MeshBasicMaterial({ color: heavy ? 0xff3b2f : 0xa7f76a, transparent: true, opacity: 0.92, depthWrite: false });
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.085), bgMat);
  const fill = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.04), fillMat);
  bg.renderOrder = 20;
  fill.renderOrder = 21;
  fill.position.z = 0.006;
  group.add(bg, fill);
  group.visible = false;
  group.scale.setScalar(heavy ? 1.35 : 1);
  scene.add(group);
  return { group, bg, fill, bgMat, fillMat, heavy };
}

function spawnEnemy(heavy = false) {
  const diff = DIFFICULTIES[game.difficulty];
  const candidates = world.spawnPoints.filter((p) => {
    const d = Math.hypot(p.x - player.pos.x, p.z - player.pos.z);
    return d > 17 && d < 52 && !collidesCircle(p.x, p.z, 0.6);
  });
  const spawn = candidates.length ? choose(candidates) : choose(world.spawnPoints);
  const model = buildEnemy(heavy);
  const baseScale = heavy ? 1.34 : rand(0.96, 1.04);
  model.group.position.set(spawn.x, 0, spawn.z);
  model.group.rotation.y = Math.atan2(player.pos.x - spawn.x, player.pos.z - spawn.z);
  model.group.scale.setScalar(baseScale * 0.08);
  scene.add(model.group);

  const e = {
    name: heavy ? 'JUGGERNAUT' : choose(ENEMY_CALLSIGNS),
    group: model.group,
    body: model.body,
    legL: model.legL,
    legR: model.legR,
    muzzle: model.muzzle,
    flash: model.flash,
    flashMat: model.flashMat,
    flare: model.flare,
    mats: model.mats,
    uniform: model.uniform,
    armor: model.armor,
    hitList: model.hitList,
    hitMeshes: [],
    baseScale,
    heavy,
    health: (heavy ? 720 : diff.health) * (1 + Math.max(0, game.wave - 1) * 0.025),
    maxHealth: (heavy ? 720 : diff.health) * (1 + Math.max(0, game.wave - 1) * 0.025),
    dead: false,
    deathT: 0,
    deathDir: Math.random() > 0.5 ? 1 : -1,
    deathShake: 0,
    spawnT: 0,
    losTimer: rand(0, 0.2),
    canSee: false,
    aimTime: 0,
    fireTimer: rand(0.6, 1.6),
    burstLeft: 0,
    burstTimer: 0,
    walkPhase: rand(0, 6.28),
    strafeDir: Math.random() > 0.5 ? 1 : -1,
    strafeTimer: rand(1.2, 3),
    flashTimer: 0,
    barTimer: 0,
    healthBar: makeHealthBar(heavy),
    lastMoveX: spawn.x,
    lastMoveZ: spawn.z,
    stuckT: 0,
  };

  model.hitList.forEach((item) => {
    item.mesh.userData.enemy = e;
    item.mesh.userData.zone = item.zone;
    e.hitMeshes.push(item.mesh);
  });
  enemyHitMeshes.push(...e.hitMeshes);
  enemies.push(e);

  dustParticles.spawn(new THREE.Vector3(spawn.x, 0.2, spawn.z), new THREE.Vector3(0, 0.7, 0), 0x7c7662, 0.45, 0.8, 0.5, 0.94);
  dustParticles.spawn(new THREE.Vector3(spawn.x, 0.1, spawn.z), new THREE.Vector3(0, 0.3, 0), 0x9b9077, 0.3, 0.6, 0.4, 0.94);
  if (heavy) {
    showBanner('HEAVY CONTACT', 'JUGGERNAUT', 'Armored unit on the field', 2600);
    radioLine('Heavy armor moving in. Focus fire and use grenades.', 'OVERWATCH');
    audio.waveHorn();
  }
  return e;
}

function dampAngle(current, target, lambda, dt) {
  const delta = wrapAngle(target - current);
  return current + delta * (1 - Math.exp(-lambda * dt));
}

function moveEnemy(e, dx, dz) {
  let moved = false;
  const nx = e.group.position.x + dx;
  if (!collidesCircle(nx, e.group.position.z, 0.32)) {
    e.group.position.x = nx;
    moved = true;
  }
  const nz = e.group.position.z + dz;
  if (!collidesCircle(e.group.position.x, nz, 0.32)) {
    e.group.position.z = nz;
    moved = true;
  }
  return moved;
}

function enemyShoot(e, dist) {
  const diff = DIFFICULTIES[game.difficulty];
  e.group.updateMatrixWorld(true);
  const muzzlePos = e.muzzle.getWorldPosition(new THREE.Vector3());
  const chest = new THREE.Vector3(player.pos.x, player.y + 1.32, player.pos.z);
  const movementFactor = player.speed > 5 ? 0.65 : player.speed > 1 ? 0.82 : 1;
  let hitChance = diff.accuracy * clamp(1.12 - dist / 90, 0.34, 1) * movementFactor;
  if (player.sprinting) hitChance *= 0.82;
  if (e.heavy) hitChance *= 1.12;
  hitChance = clamp(hitChance, 0.03, 0.68);

  const hit = Math.random() < hitChance;
  const end = chest.clone();
  if (!hit) {
    end.x += rand(-2.4, 2.4);
    end.y += rand(-1.1, 1.2);
    end.z += rand(-2.4, 2.4);
  } else {
    end.x += rand(-0.12, 0.12);
    end.z += rand(-0.12, 0.12);
  }
  tracers.spawn(muzzlePos, end, 0xffa14b, 0.075);
  e.flashTimer = 0.055;
  e.flash.visible = true;
  e.flashMat.opacity = 1;
  e.flash.scale.setScalar(rand(0.45, 0.7));

  const dx = e.group.position.x - player.pos.x;
  const dz = e.group.position.z - player.pos.z;
  const rightX = Math.cos(player.yaw);
  const rightZ = -Math.sin(player.yaw);
  const pan = clamp((dx * rightX + dz * rightZ) / 15, -0.82, 0.82);
  audio.enemyShot(pan, dist);
  if (!hit && dist < 15) audio.whiz(pan);

  if (hit) {
    const dmg = diff.damage * (e.heavy ? 1.5 : 1) * rand(0.8, 1.2);
    damagePlayer(dmg, e.group.position);
  }
  spawnMuzzleSmoke(muzzlePos, new THREE.Vector3().subVectors(end, muzzlePos).normalize());
}

function damageEnemy(enemy, amount, zone, point, weaponName = 'M4A1') {
  if (enemy.dead || game.phase === 'dead') return;
  enemy.health -= amount;
  enemy.barTimer = 2.4;
  enemy.hitFlash = 0.1;
  enemy.uniform.emissive.setHex(0x5a1208);
  enemy.uniform.emissiveIntensity = 0.9;
  if (enemy.health <= 0) killEnemy(enemy, zone, weaponName);
}

function killEnemy(enemy, zone, weaponName) {
  if (enemy.dead) return;
  enemy.dead = true;
  enemy.health = 0;
  enemy.deathT = 0;
  enemy.deathDir = Math.random() > 0.5 ? 1 : -1;
  enemy.healthBar.group.visible = false;
  enemy.group.rotation.z = 0;
  enemy.flash.visible = false;
  enemyHitMeshes = enemyHitMeshes.filter((m) => m.userData.enemy !== enemy);
  enemy.mats.forEach((m) => {
    m.transparent = true;
    m.opacity = 1;
  });

  const headshot = zone === 'head';
  game.kills++;
  if (game.comboTimer > 0) game.combo = Math.min(5, game.combo + 1);
  else game.combo = 1;
  game.comboTimer = 2.8;
  const comboBonus = Math.max(0, game.combo - 1) * 25;
  const points = 100 + (headshot ? 50 : 0) + comboBonus + (enemy.heavy ? 500 : 0);
  game.score += points;
  addKillfeed(enemy.name, headshot, enemy.heavy);
  showKillmarker();
  showScore(points, headshot ? 'HEADSHOT' : enemy.heavy ? 'HEAVY DOWN' : game.combo > 1 ? `${game.combo}x CHAIN` : 'ELIMINATION');
  audio.kill();

  const worldPoint = enemy.group.position.clone().setY(1.2 * enemy.baseScale);
  spawnBlood(worldPoint, new THREE.Vector3(rand(-1, 1), 0.2, rand(-1, 1)));
  dustParticles.spawn(enemy.group.position.clone().setY(0.35), new THREE.Vector3(0, 0.6, 0), 0x786f5f, 0.4, 0.8, 0.4, 0.95);

  const dropChance = enemy.heavy ? 1 : 0.34;
  if (Math.random() < dropChance) {
    const type = Math.random() > 0.46 ? 'ammo' : 'health';
    spawnPickup(enemy.group.position.clone(), type);
    if (enemy.heavy) spawnPickup(enemy.group.position.clone().add(new THREE.Vector3(0.7, 0, 0.6)), type === 'ammo' ? 'health' : 'ammo');
  }

  if (enemy.heavy) {
    spawnShockwave(enemy.group.position.clone().setY(0.8), 0xffa84f, 5.5);
    player.shake = Math.max(player.shake, 0.8);
    showSubtitle('JUGGERNAUT DOWN', 2200);
    radioLine('Heavy is down. Sector is nearly clear.', 'RAVEN');
    audio.explosion(0);
  }

  if (game.wave >= 4 && game.kills % 7 === 0) {
    radioLine(choose(['Good effect on target.', 'Keep the pressure on.', 'Relay is holding. Push them back.']), 'OVERWATCH');
  }
}

function updateEnemies(dt) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (e.dead) {
      e.deathT += dt;
      const p = Math.min(1, e.deathT / 0.7);
      e.group.rotation.z = e.deathDir * p * 1.36;
      e.group.position.y = -Math.min(1, e.deathT / 1.4) * 0.16;
      e.flash.visible = false;
      if (e.deathT > 4.4) {
        const fade = clamp(1 - (e.deathT - 4.4) / 1.8, 0, 1);
        e.mats.forEach((m) => {
          m.opacity = fade;
        });
      }
      if (e.deathT > 6.4) {
        scene.remove(e.group);
        e.mats.forEach((m) => m.dispose());
        scene.remove(e.healthBar.group);
        e.healthBar.bgMat.dispose();
        e.healthBar.fillMat.dispose();
        enemies.splice(i, 1);
      }
      continue;
    }

    e.spawnT += dt;
    const spawnP = clamp(e.spawnT / 0.52, 0, 1);
    const ease = 1 - Math.pow(1 - spawnP, 3);
    e.group.scale.setScalar(e.baseScale * (0.08 + ease * 0.92));

    if (e.hitFlash > 0) {
      e.hitFlash -= dt;
      if (e.hitFlash <= 0) {
        e.uniform.emissive.setHex(0x000000);
        e.uniform.emissiveIntensity = 0;
      }
    }
    if (e.flashTimer > 0) {
      e.flashTimer -= dt;
      if (e.flashTimer <= 0) {
        e.flash.visible = false;
        e.flashMat.opacity = 0;
      } else {
        e.flashMat.opacity = e.flashTimer / 0.055;
      }
    }

    if (e.barTimer > 0) e.barTimer -= dt;
    e.healthBar.group.visible = e.barTimer > 0 && game.phase !== 'dead';
    if (e.healthBar.group.visible) {
      e.healthBar.group.position.set(
        e.group.position.x,
        e.group.position.y + 2.15 * e.baseScale + 0.12,
        e.group.position.z
      );
      e.healthBar.group.quaternion.copy(camera.quaternion);
      const ratio = clamp(e.health / e.maxHealth, 0, 1);
      e.healthBar.fill.scale.x = Math.max(0.001, ratio);
      e.healthBar.fill.position.x = -0.33 + 0.33 * ratio;
      e.healthBar.fillMat.color.setHex(e.heavy ? 0xff3b2f : ratio < 0.3 ? 0xffb14d : 0xa7f76a);
    }

    if (spawnP < 0.8) continue;

    const dx = player.pos.x - e.group.position.x;
    const dz = player.pos.z - e.group.position.z;
    const dist = Math.hypot(dx, dz);

    e.losTimer -= dt;
    if (e.losTimer <= 0) {
      e.losTimer = rand(0.16, 0.3);
      const eye = new THREE.Vector3(e.group.position.x, e.group.position.y + 1.55 * e.baseScale, e.group.position.z);
      const chest = new THREE.Vector3(player.pos.x, player.y + 1.3, player.pos.z);
      e.canSee = isVisibleFrom(eye, chest);
    }

    const targetYaw = Math.atan2(dx, dz);
    e.group.rotation.y = dampAngle(e.group.rotation.y, targetYaw, e.canSee ? 7 : 4, dt);

    // Pick a new flank direction regularly so they don't form a conga line.
    e.strafeTimer -= dt;
    if (e.strafeTimer <= 0) {
      e.strafeTimer = rand(1.5, 3.6);
      e.strafeDir *= -1;
    }

    let moveX = 0;
    let moveZ = 0;
    if (dist > 0.001) {
      const nx = dx / dist;
      const nz = dz / dist;
      const strafeX = nz * e.strafeDir;
      const strafeZ = -nx * e.strafeDir;
      const desiredRange = e.heavy ? 15 : 12;
      let approach = 0;
      let strafe = 0;
      if (!e.canSee || dist > 24) {
        approach = 1;
        strafe = 0.24;
      } else if (dist > desiredRange + 5) {
        approach = 0.72;
        strafe = 0.45;
      } else if (dist < 6.5) {
        approach = -0.9;
        strafe = 0.45;
      } else {
        approach = 0.08;
        strafe = 1;
      }
      moveX = nx * approach + strafeX * strafe;
      moveZ = nz * approach + strafeZ * strafe;

      // Separation from other hostiles
      for (const other of enemies) {
        if (other === e || other.dead) continue;
        const ox = e.group.position.x - other.group.position.x;
        const oz = e.group.position.z - other.group.position.z;
        const od = Math.hypot(ox, oz);
        if (od > 0.01 && od < 1.35) {
          moveX += (ox / od) * (1.35 - od) * 1.4;
          moveZ += (oz / od) * (1.35 - od) * 1.4;
        }
      }

      const len = Math.hypot(moveX, moveZ) || 1;
      moveX /= len;
      moveZ /= len;
      const speed = (e.heavy ? 0.95 : 1.75) * DIFFICULTIES[game.difficulty].speed * (e.canSee ? 1 : 1.22);
      const moved = moveEnemy(e, moveX * speed * dt, moveZ * speed * dt);
      if (!moved) {
        // Try a tangent if we are pinned against cover.
        const tx = -moveZ * 1.2;
        const tz = moveX * 1.2;
        moveEnemy(e, tx * speed * dt, tz * speed * dt);
      }
      const walkSpeed = Math.hypot(moveX * speed, moveZ * speed);
      e.walkPhase += dt * (3.5 + walkSpeed * 2.4);
      const swing = Math.sin(e.walkPhase) * 0.45 * clamp(walkSpeed / 2, 0.5, 1);
      e.legL.rotation.x = swing;
      e.legR.rotation.x = -swing;
      e.body.position.y = Math.abs(Math.sin(e.walkPhase * 2)) * 0.025;
    }

    if (game.phase === 'active' && game.health > 0) {
      if (e.canSee && dist < 52) {
        e.aimTime += dt;
        if (e.aimTime > (e.heavy ? 0.72 : 0.92)) {
          if (e.burstLeft > 0) {
            e.burstTimer -= dt;
            if (e.burstTimer <= 0) {
              enemyShoot(e, dist);
              e.burstLeft--;
              e.burstTimer = e.heavy ? 0.09 : rand(0.14, 0.2);
            }
          } else {
            e.fireTimer -= dt;
            if (e.fireTimer <= 0) {
              e.burstLeft = e.heavy ? 7 : Math.floor(rand(2, 4));
              e.burstTimer = 0;
              e.fireTimer = e.heavy ? rand(2.1, 2.8) : rand(2.4, 3.8);
            }
          }
        }
      } else {
        e.aimTime = Math.max(0, e.aimTime - dt * 0.8);
      }
    }
  }
  game.comboTimer = Math.max(0, game.comboTimer - dt);
  if (game.comboTimer <= 0) game.combo = 0;
}

function aliveEnemies() {
  let count = 0;
  for (const e of enemies) if (!e.dead) count++;
  return count;
}

// ---------------------------------------------------------------- PICKUPS
function spawnPickup(position, type) {
  if (pickups.length > 12) {
    const old = pickups.shift();
    scene.remove(old.group);
  }
  const group = new THREE.Group();
  const isHealth = type === 'health';
  const baseMat = new THREE.MeshStandardMaterial({
    color: isHealth ? 0xe9f6d4 : 0x4e5b36,
    roughness: 0.5,
    metalness: 0.35,
    emissive: isHealth ? 0x1b3b1b : 0x1a1f0b,
    emissiveIntensity: 0.6,
  });
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.24, 0.34), baseMat);
  box.castShadow = true;
  group.add(box);
  if (isHealth) {
    const crossMat = new THREE.MeshBasicMaterial({ color: 0xaaff88 });
    const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.04, 0.05), crossMat);
    c1.position.set(0, 0.15, 0);
    const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.19), crossMat);
    c2.position.set(0, 0.15, 0);
    group.add(c1, c2);
  } else {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.06, 0.36), new THREE.MeshBasicMaterial({ color: 0xffc45a }));
    band.position.y = 0.05;
    group.add(band);
  }
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture,
    color: isHealth ? 0x8dff8c : 0xffd36d,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  glow.scale.set(1.2, 1.2, 1);
  group.add(glow);
  group.position.copy(position);
  group.position.y = 0.45;
  scene.add(group);
  pickups.push({ group, type, phase: rand(0, 6.28), baseY: 0.45 });
}

function updatePickups(dt, time) {
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    p.group.rotation.y += dt * 1.6;
    p.group.position.y = p.baseY + Math.sin(time * 2.4 + p.phase) * 0.09;
    const d = Math.hypot(p.group.position.x - player.pos.x, p.group.position.z - player.pos.z);
    if (d < 1.25) {
      if (p.type === 'health') {
        game.health = Math.min(game.maxHealth, game.health + 28);
        showToast('TRAUMA KIT // +28 VITALS');
        updateHealthHud();
      } else {
        const w = weaponState.current;
        w.reserve = Math.min(w.maxReserve, w.reserve + 36);
        const other = weaponState.id === 'rifle' ? weaponSystem.weapons.pistol : weaponSystem.weapons.rifle;
        other.reserve = Math.min(other.maxReserve, other.reserve + 12);
        if (Math.random() > 0.5) {
          game.grenades = Math.min(game.maxGrenades, game.grenades + 1);
          updateGrenadeHud();
        }
        showToast('AMMO CACHE // +36 ROUNDS');
        updateAmmoHud();
      }
      audio.pickup();
      spawnPickupDust(p.group.position);
      scene.remove(p.group);
      pickups.splice(i, 1);
    }
  }
}

// ---------------------------------------------------------------- GRENADES
function throwGrenade() {
  if (game.mode !== 'playing' || game.phase === 'dead' || game.grenades <= 0 || weaponState.switchTimer > 0) return;
  game.grenades--;
  updateGrenadeHud();
  audio.ui();
  const material = new THREE.MeshStandardMaterial({
    color: 0x303a2d,
    roughness: 0.55,
    metalness: 0.55,
    emissive: 0xff2608,
    emissiveIntensity: 1.2,
  });
  const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 1), material);
  mesh.castShadow = true;
  const start = camera.position.clone().add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(0.55));
  mesh.position.copy(start);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color: 0xff4a24, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.scale.set(0.45, 0.45, 1);
  mesh.add(glow);
  scene.add(mesh);
  const dir = camera.getWorldDirection(new THREE.Vector3());
  const velocity = dir.multiplyScalar(14.5).add(new THREE.Vector3(0, 4.4, 0)).add(player.vel.clone().multiplyScalar(0.35));
  grenades.push({ mesh, velocity, timer: 2.15, phase: 0, glow });
  weaponState.kick = 0.7;
}

function explode(position, radius = 8.5, damage = 220) {
  audio.explosion(0);
  spawnShockwave(position.clone().setY(0.6), 0xffb15a, 7);
  const lightSlot = explosionLights[explosionLightCursor++ % explosionLights.length];
  lightSlot.light.position.copy(position);
  lightSlot.light.intensity = 180;
  lightSlot.life = 0.42;
  for (let i = 0; i < 26; i++) {
    sparkParticles.spawn(
      position,
      new THREE.Vector3(rand(-6, 6), rand(0.5, 8), rand(-6, 6)),
      i % 3 === 0 ? 0xffd591 : 0xff7c2b,
      rand(0.025, 0.08),
      rand(0.35, 0.85),
      8,
      0.98
    );
  }
  for (let i = 0; i < 16; i++) {
    dustParticles.spawn(
      position.clone().setY(position.y + 0.2),
      new THREE.Vector3(rand(-4, 4), rand(0.4, 3.4), rand(-4, 4)),
      0x746b5d,
      rand(0.2, 0.5),
      rand(0.7, 1.5),
      1.3,
      0.94
    );
  }
  player.shake = Math.max(player.shake, 0.85);
  const playerDist = camera.position.distanceTo(position);
  if (playerDist < radius) {
    damagePlayer((1 - playerDist / radius) * 52 + 6, position);
  }
  for (const e of enemies) {
    if (e.dead) continue;
    const d = e.group.position.distanceTo(position);
    if (d < radius) {
      const falloff = 1 - d / radius;
      damageEnemy(e, damage * falloff, 'body', e.group.position.clone(), 'FRAG');
    }
  }
}

function updateGrenades(dt) {
  for (let i = grenades.length - 1; i >= 0; i--) {
    const g = grenades[i];
    g.timer -= dt;
    g.phase += dt * (5 + Math.max(0, 2.15 - g.timer) * 7);
    g.mesh.material.emissiveIntensity = 0.5 + Math.max(0, Math.sin(g.phase * 3)) * 2.5;
    g.glow.material.opacity = 0.2 + Math.max(0, Math.sin(g.phase * 3)) * 0.35;
    g.velocity.y -= 17.5 * dt;
    g.mesh.rotation.x += dt * 8;
    g.mesh.rotation.z += dt * 5;
    const nx = g.mesh.position.x + g.velocity.x * dt;
    if (!collidesCircle(nx, g.mesh.position.z, 0.12)) g.mesh.position.x = nx;
    else {
      g.velocity.x *= -0.5;
      if (Math.abs(g.velocity.x) > 1.2) audio.grenadeBounce();
    }
    const nz = g.mesh.position.z + g.velocity.z * dt;
    if (!collidesCircle(g.mesh.position.x, nz, 0.12)) g.mesh.position.z = nz;
    else {
      g.velocity.z *= -0.5;
      if (Math.abs(g.velocity.z) > 1.2) audio.grenadeBounce();
    }
    g.mesh.position.y += g.velocity.y * dt;
    if (g.mesh.position.y < 0.11) {
      g.mesh.position.y = 0.11;
      g.velocity.y *= -0.36;
      g.velocity.x *= 0.72;
      g.velocity.z *= 0.72;
      if (Math.abs(g.velocity.y) > 1) audio.grenadeBounce();
    }
    if (g.timer <= 0) {
      const pos = g.mesh.position.clone();
      scene.remove(g.mesh);
      g.mesh.material.dispose();
      grenades.splice(i, 1);
      explode(pos);
    }
  }
}

function updateExplosionLights(dt) {
  for (const slot of explosionLights) {
    if (slot.life <= 0) continue;
    slot.life -= dt;
    slot.light.intensity = Math.max(0, slot.life / 0.42) * 180;
  }
}

// ---------------------------------------------------------------- MISSION FLOW
function clearBattle() {
  for (const e of enemies) {
    scene.remove(e.group);
    e.mats.forEach((m) => m.dispose());
    scene.remove(e.healthBar.group);
    e.healthBar.bgMat.dispose();
    e.healthBar.fillMat.dispose();
  }
  enemies = [];
  enemyHitMeshes = [];
  for (const p of pickups) scene.remove(p.group);
  pickups = [];
  for (const g of grenades) {
    scene.remove(g.mesh);
    g.mesh.material.dispose();
  }
  grenades = [];
  dustParticles.clear();
  sparkParticles.clear();
  bloodParticles.clear();
  tracers.clear();
  for (const d of decals) d.visible = false;
  for (const s of shockwaves) {
    s.life = 0;
    s.mesh.visible = false;
  }
  for (const slot of explosionLights) {
    slot.life = 0;
    slot.light.intensity = 0;
  }
}

function resupply() {
  game.health = game.maxHealth;
  game.grenades = game.maxGrenades;
  for (const w of Object.values(weaponSystem.weapons)) {
    w.ammo = w.magSize;
    w.reserve = w.maxReserve;
  }
  weaponState.reloading = false;
  weaponState.reloadTimer = 0;
  updateWeaponHud();
  updateHealthHud();
  updateGrenadeHud();
  showToast('RELAY RE-ARMED // FULL RESUPPLY');
}

function startWave(n) {
  game.wave = n;
  game.phase = 'active';
  game.spawnTimer = 0.2;
  game.interTimer = 0;
  const data = WAVE_DATA[n - 1];
  const queue = [];
  for (let i = 0; i < data.count; i++) queue.push({ heavy: false });
  if (n === 6) queue.splice(3, 0, { heavy: true });
  game.spawnQueue = queue;
  game.waveTotal = queue.length;
  showBanner(`WAVE ${pad(n)} / ${pad(TOTAL_WAVES)}`, data.title, data.sub, 3300);
  radioLine(choose([
    'Multiple hostiles converging on the relay. Hold fast.',
    'Contacts moving through the side streets. Watch your flanks.',
    'They are pushing hard. Use the cover and make every round count.',
    'Uplink is still green. Keep them off the relay.',
  ]), 'OVERWATCH');
  audio.waveHorn();
  updateWavePips();
  setObjective('ELIMINATE HOSTILES', `Wave ${n} of ${TOTAL_WAVES}`, queue.length);
  if (n === TOTAL_WAVES) {
    setTimeout(() => showSubtitle('<b>JUGGERNAUT</b> // HEAVY ARMOR INBOUND', 2600), 1600);
  }
}

function onWaveCleared() {
  game.wavesCleared = game.wave;
  game.score += game.wave * 500;
  showScore(game.wave * 500, 'WAVE CLEARED');
  if (game.bestWave < game.wave) {
    game.bestWave = game.wave;
    saveSettings();
  }
  if (game.wave >= TOTAL_WAVES) {
    game.phase = 'extract';
    game.interTimer = 5.2;
    setObjective('EXTRACTION INBOUND', 'Hold position. Dust-off is closing.', 0);
    showBanner('SECTOR SECURED', 'EXTRACTION', 'All hostiles eliminated // dust-off inbound', 4800);
    radioLine('Sector is clear. Relay is online. Extraction is inbound.', 'OVERWATCH');
    showSubtitle('MISSION COMPLETE // EXTRACTION INBOUND', 4200);
    audio.waveHorn();
    updateWavePips();
  } else {
    game.phase = 'intermission';
    game.interTimer = 9;
    resupply();
    game.wavesCleared = game.wave;
    setObjective('REGROUP', `Next wave in 09 seconds`, 0);
    showBanner('SECTOR CLEAR', `WAVE ${pad(game.wave)} CLEARED`, 'Relay re-armed // resupplying', 3400);
    radioLine('Sector clear for now. Resupply at the relay and stack up.', 'OVERWATCH');
    updateWavePips();
  }
}

function updateWaves(dt) {
  if (game.phase === 'prep') {
    game.interTimer -= dt;
    if (game.interTimer <= 0) startWave(1);
    return;
  }
  if (game.phase === 'intermission') {
    game.interTimer -= dt;
    const remaining = Math.max(0, Math.ceil(game.interTimer));
    setObjective('REGROUP', `Next wave in ${pad(remaining)} seconds`, 0);
    if (game.interTimer <= 0) startWave(game.wave + 1);
    return;
  }
  if (game.phase === 'extract') {
    game.interTimer -= dt;
    if (game.interTimer <= 0) endMission(true);
    return;
  }
  if (game.phase === 'dead') {
    game.deathTimer += dt;
    if (game.deathTimer > 1.9) endMission(false);
    return;
  }
  if (game.phase !== 'active') return;

  const alive = aliveEnemies();
  const maxAlive = Math.min(10, 4 + game.wave);

  if (game.spawnQueue.length > 0 && alive < maxAlive) {
    game.spawnTimer -= dt;
    if (game.spawnTimer <= 0) {
      const spec = game.spawnQueue.shift();
      spawnEnemy(spec.heavy);
      game.spawnTimer = spec.heavy ? 1.15 : rand(0.55, 1.1);
      updateWavePips();
    }
  }

  const remaining = alive + game.spawnQueue.length;
  setObjective(
    game.wave === TOTAL_WAVES && enemies.some((e) => e.heavy && !e.dead) ? 'DESTROY THE JUGGERNAUT' : 'ELIMINATE HOSTILES',
    `Wave ${game.wave} of ${TOTAL_WAVES}`,
    remaining
  );
  if (game.spawnQueue.length === 0 && alive === 0) onWaveCleared();
}

function onPlayerDeath() {
  if (game.phase === 'dead') return;
  game.phase = 'dead';
  game.deathTimer = 0;
  game.health = 0;
  weaponState.triggerHeld = false;
  updateHealthHud();
  audio.playerDeath();
  showBanner('OPERATOR DOWN', 'SIGNAL LOST', 'Relay defense has failed', 4200);
  showSubtitle('KIA // SECTOR 7 OVERRUN', 3000);
  if (document.pointerLockElement) document.exitPointerLock();
}

function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
}

function endMission(success) {
  if (game.mode === 'end') return;
  game.mode = 'end';
  game.phase = 'idle';
  if (document.pointerLockElement) document.exitPointerLock();
  ui.touchControls.classList.add('hidden');
  ui.hud.classList.add('hidden');
  ui.lockHint.classList.add('hidden');
  const accuracy = game.shots > 0 ? Math.round((game.hits / game.shots) * 100) : 0;
  const wavesCleared = success ? TOTAL_WAVES : Math.max(0, game.wavesCleared);
  if (game.bestWave < wavesCleared) game.bestWave = wavesCleared;
  if (game.bestKills < game.kills) game.bestKills = game.kills;
  saveSettings();
  refreshBestStats();

  ui.endStatus.textContent = success ? 'SECTOR SECURED // RELAY ONLINE' : 'OPERATOR KIA // SECTOR LOST';
  ui.endTitle.innerHTML = success ? 'MISSION<br><span>COMPLETE</span>' : 'MISSION<br><span>FAILED</span>';
  ui.endDesc.textContent = success
    ? 'The relay is online. Extraction is inbound. Sector 7 is dark, but it is ours.'
    : 'The relay has gone dark. Sector 7 belongs to the enemy. Regroup and try again.';
  ui.endWaves.textContent = `${wavesCleared} / ${TOTAL_WAVES}`;
  ui.endKills.textContent = game.kills;
  ui.endAccuracy.textContent = `${accuracy}%`;
  ui.endHeads.textContent = game.headshots;
  ui.endTime.textContent = formatTime(game.missionTime);
  ui.endScore.textContent = game.score.toLocaleString('en-US');
  ui.end.classList.remove('hidden');
  ui.end.querySelector('.sheet').style.borderTopColor = success ? 'var(--acid)' : 'var(--red)';
  ui.endTitle.querySelector('span').style.color = success ? 'var(--accent)' : 'var(--red)';
  ui.endStatus.style.color = success ? 'var(--acid)' : 'var(--red)';
  audio.waveHorn();
}

function startMission() {
  clearBattle();
  clearCombatText();
  game.mode = 'playing';
  game.phase = 'prep';
  game.started = true;
  game.wave = 0;
  game.waveTotal = 0;
  game.spawnQueue = [];
  game.spawnTimer = 0;
  game.interTimer = 3.8;
  game.missionTime = 0;
  game.deathTimer = 0;
  game.difficulty = settings.difficulty;
  game.health = game.maxHealth;
  game.lastDamage = 99;
  game.grenades = game.maxGrenades;
  game.kills = 0;
  game.headshots = 0;
  game.shots = 0;
  game.hits = 0;
  game.score = 0;
  game.wavesCleared = 0;
  game.combo = 0;
  game.comboTimer = 0;
  game.deathTimer = 0;

  player.pos.set(0, 0, 20);
  player.y = 0;
  player.vel.set(0, 0, 0);
  player.yaw = 0;
  player.pitch = -0.025;
  player.recoilPitch = 0;
  player.recoilYaw = 0;
  player.health = 100;
  player.speed = 0;
  player.grounded = true;
  player.sprinting = false;
  player.deadTilt = 0;
  player.shake = 0;
  player.mouseDX = 0;
  player.mouseDY = 0;
  player.bobTime = 0;

  for (const w of Object.values(weaponSystem.weapons)) {
    w.ammo = w.magSize;
    w.reserve = w.maxReserve;
  }
  weaponState.current = weaponSystem.weapons.rifle;
  weaponState.id = 'rifle';
  weaponState.ads = 0;
  weaponState.reloading = false;
  weaponState.reloadTimer = 0;
  weaponState.switchTimer = 0;
  weaponState.kick = 0;
  weaponState.triggerHeld = false;
  weaponState.triggerPressed = false;
  weaponState.knifeTimer = 0;
  weaponSystem.show('rifle');
  weaponSystem.root.visible = true;
  weaponSystem.root.position.copy(weaponState.current.hipPos);
  weaponSystem.root.rotation.set(0, 0, 0);

  input.fire = false;
  input.aim = false;
  input.touchMoveX = 0;
  input.touchMoveY = 0;
  keys.clear();

  camera.fov = 73;
  camera.updateProjectionMatrix();
  camera.position.set(player.pos.x, player.eye, player.pos.z);
  camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');

  ui.hud.classList.remove('hidden');
  ui.menu.classList.add('hidden');
  ui.menu.style.opacity = '';
  ui.end.classList.add('hidden');
  ui.pause.classList.add('hidden');
  ui.manual.classList.add('hidden');
  ui.touchControls.classList.toggle('hidden', !IS_TOUCH);
  ui.lockHint.classList.toggle('hidden', IS_TOUCH || !!document.pointerLockElement);
  ui.threatLevel.textContent = DIFFICULTIES[game.difficulty].label;
  ui.difficultyDesc.textContent = DIFFICULTIES[game.difficulty].desc;
  ui.feedEmpty.style.opacity = '1';
  buildWavePips();
  updateWaveHudFull();
  updateHealthHud();
  updateGrenadeHud();
  updateWeaponHud();

  setObjective('SECURE THE RELAY', 'Prepare for contact', 0);
  showBanner('OPERATION BLACKOUT', 'BROKEN LINE', 'Sector 7 // hold the relay', 3700);
  showSubtitle('MISSION START // <b>SECTOR 7</b>', 3400);
  radioLine('Bravo, relay is dark and hostiles are converging. Hold until extraction.', 'OVERWATCH');
  setTimeout(() => radioLine('Copy. We hold the line. Keep that uplink green.', 'RAVEN'), 900);
}

function updateWaveHudFull() {
  updateWavePips();
  updateHealthHud();
  updateGrenadeHud();
  updateWeaponHud();
}

// ---------------------------------------------------------------- POINTER LOOK
function requestPointerLock() {
  if (IS_TOUCH) return;
  if (document.pointerLockElement === canvas) return;
  try {
    const result = canvas.requestPointerLock();
    if (result && typeof result.catch === 'function') result.catch(() => {});
  } catch {
    /* pointer lock can be blocked inside some embeds */
  }
}

function applyLook(dx, dy) {
  if (game.mode !== 'playing' || game.phase === 'dead') return;
  const adsScale = weaponState.ads > 0.55 ? 0.58 : 1;
  const sens = settings.sensitivity * 0.00225 * adsScale;
  player.yaw -= dx * sens;
  const invert = settings.invertY ? -1 : 1;
  player.pitch = clamp(player.pitch - dy * sens * invert, -1.45, 1.45);
  player.mouseDX += dx;
  player.mouseDY += dy;
}

function setupInput() {
  window.addEventListener('keydown', (e) => {
    if (e.repeat && ['KeyR', 'KeyG', 'KeyV', 'Digit1', 'Digit2', 'KeyM'].includes(e.code)) return;
    keys.add(e.code);

    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (!ui.manual.classList.contains('hidden')) {
        closeManual();
        return;
      }
      if (game.mode === 'playing') {
        pauseGame();
        return;
      }
      if (game.mode === 'paused') {
        resumeGame();
        return;
      }
    }

    if (game.mode !== 'playing' || game.phase === 'dead') {
      if (e.code === 'Enter' && game.mode === 'menu') deployMission();
      return;
    }

    if (e.code === 'KeyR') beginReload();
    if (e.code === 'Digit1') switchWeapon('rifle');
    if (e.code === 'Digit2') switchWeapon('pistol');
    if (e.code === 'KeyG') throwGrenade();
    if (e.code === 'KeyV') doMelee();
    if (e.code === 'KeyM') toggleMute();
    if (e.code === 'Space') {
      e.preventDefault();
      input.jump = true;
    }
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) {
      e.preventDefault();
      const rotSpeed = 1.7 * (60 / 1000);
      if (e.code === 'ArrowLeft') player.yaw += rotSpeed;
      if (e.code === 'ArrowRight') player.yaw -= rotSpeed;
      if (e.code === 'ArrowUp') player.pitch = clamp(player.pitch + rotSpeed, -1.45, 1.45);
      if (e.code === 'ArrowDown') player.pitch = clamp(player.pitch - rotSpeed, -1.45, 1.45);
    }
  });

  window.addEventListener('keyup', (e) => {
    keys.delete(e.code);
  });

  window.addEventListener('blur', () => {
    keys.clear();
    input.fire = false;
    input.aim = false;
    weaponState.triggerHeld = false;
    if (game.mode === 'playing') pauseGame();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.mode === 'playing') pauseGame();
  });

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('contextmenu', (e) => {
    if (game.mode === 'playing') e.preventDefault();
  });

  document.addEventListener('mousedown', (e) => {
    if (game.mode !== 'playing' || game.phase === 'dead' || IS_TOUCH) return;
    const target = e.target;
    if (target.closest('button, input, label, .sheet, .screen')) return;
    if (document.pointerLockElement !== canvas) {
      requestPointerLock();
      ui.lockHint.classList.remove('hidden');
      return;
    }
    if (e.button === 0) {
      weaponState.triggerHeld = true;
      weaponState.triggerPressed = true;
      input.fire = true;
    }
    if (e.button === 2) {
      input.aim = true;
      e.preventDefault();
    }
  });

  document.addEventListener('mouseup', (e) => {
    if (e.button === 0) {
      weaponState.triggerHeld = false;
      input.fire = false;
    }
    if (e.button === 2) input.aim = false;
  });

  document.addEventListener('mousemove', (e) => {
    if (game.mode !== 'playing' || IS_TOUCH) return;
    if (document.pointerLockElement === canvas) {
      applyLook(e.movementX || 0, e.movementY || 0);
    }
  });

  document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === canvas;
    if (locked) {
      ui.lockHint.classList.add('hidden');
    } else if (game.mode === 'playing' && game.phase !== 'dead' && game.phase !== 'extract' && !IS_TOUCH) {
      pauseGame();
    }
  });

  document.addEventListener('pointerlockerror', () => {
    if (game.mode === 'playing' && !IS_TOUCH) ui.lockHint.classList.remove('hidden');
  });

  // Desktop drag fallback keeps the game playable if pointer lock is blocked by an embed.
  let dragging = false;
  let lastDragX = 0;
  let lastDragY = 0;
  canvas.addEventListener('mousedown', (e) => {
    if (game.mode !== 'playing' || IS_TOUCH || document.pointerLockElement === canvas) return;
    if (e.button === 0) {
      dragging = true;
      lastDragX = e.clientX;
      lastDragY = e.clientY;
    }
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging || game.mode !== 'playing' || document.pointerLockElement === canvas) return;
    applyLook(e.clientX - lastDragX, e.clientY - lastDragY);
    lastDragX = e.clientX;
    lastDragY = e.clientY;
  });
  window.addEventListener('mouseup', () => {
    dragging = false;
  });
}

// ---------------------------------------------------------------- TOUCH CONTROLS
function setupTouch() {
  $('btnPause').addEventListener('click', () => {
    if (game.mode === 'playing') pauseGame();
  });
  const stickZone = $('stickZone');
  const stickBase = $('stickBase');
  const stickKnob = $('stickKnob');
  let stickId = null;

  function updateStick(e) {
    const rect = stickBase.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const max = rect.width * 0.34;
    const mag = Math.hypot(dx, dy);
    if (mag > max) {
      dx = (dx / mag) * max;
      dy = (dy / mag) * max;
    }
    stickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    input.touchMoveX = dx / max;
    input.touchMoveY = -dy / max;
  }

  stickZone.addEventListener('pointerdown', (e) => {
    if (game.mode !== 'playing') return;
    e.preventDefault();
    e.stopPropagation();
    stickId = e.pointerId;
    stickZone.setPointerCapture(e.pointerId);
    stickZone.classList.add('active');
    updateStick(e);
  });
  stickZone.addEventListener('pointermove', (e) => {
    if (e.pointerId !== stickId) return;
    e.preventDefault();
    updateStick(e);
  });
  const releaseStick = (e) => {
    if (e.pointerId !== stickId) return;
    stickId = null;
    input.touchMoveX = 0;
    input.touchMoveY = 0;
    stickKnob.style.transform = 'translate(0px, 0px)';
    stickZone.classList.remove('active');
  };
  stickZone.addEventListener('pointerup', releaseStick);
  stickZone.addEventListener('pointercancel', releaseStick);

  // Buttons
  const holdButton = (id, onDown, onUp) => {
    const el = $(id);
    el.addEventListener('pointerdown', (e) => {
      if (game.mode !== 'playing') return;
      e.preventDefault();
      e.stopPropagation();
      el.setPointerCapture(e.pointerId);
      el.classList.add('pressed');
      onDown();
    });
    const up = (e) => {
      e.preventDefault();
      e.stopPropagation();
      el.classList.remove('pressed');
      onUp?.();
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', (e) => {
      if (e.buttons === 0) el.classList.remove('pressed');
    });
  };

  holdButton('btnFire', () => {
    weaponState.triggerHeld = true;
    weaponState.triggerPressed = true;
    input.fire = true;
  }, () => {
    weaponState.triggerHeld = false;
    input.fire = false;
  });
  holdButton('btnAim', () => {
    input.aim = true;
  }, () => {
    input.aim = false;
  });
  holdButton('btnReload', () => beginReload(), null);
  holdButton('btnJump', () => {
    input.jump = true;
  }, null);
  holdButton('btnGrenade', () => throwGrenade(), null);
  holdButton('btnSwap', () => switchWeapon(weaponState.id === 'rifle' ? 'pistol' : 'rifle'), null);

  // Right-side touch look.
  let lookId = null;
  let lastX = 0;
  let lastY = 0;
  const startLook = (e) => {
    if (!IS_TOUCH || game.mode !== 'playing' || game.phase === 'dead') return;
    if (lookId !== null) return;
    e.preventDefault();
    lookId = e.pointerId;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('looking');
  };
  const moveLook = (e) => {
    if (e.pointerId !== lookId) return;
    e.preventDefault();
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    const adsScale = weaponState.ads > 0.55 ? 0.62 : 1;
    player.yaw -= dx * 0.0031 * settings.sensitivity * adsScale;
    const invert = settings.invertY ? -1 : 1;
    player.pitch = clamp(player.pitch - dy * 0.0031 * settings.sensitivity * adsScale * invert, -1.45, 1.45);
    player.mouseDX += dx * 0.4;
    player.mouseDY += dy * 0.4;
  };
  const endLook = (e) => {
    if (e.pointerId !== lookId) return;
    lookId = null;
    canvas.classList.remove('looking');
  };
  canvas.addEventListener('pointerdown', startLook);
  canvas.addEventListener('pointermove', moveLook);
  canvas.addEventListener('pointerup', endLook);
  canvas.addEventListener('pointercancel', endLook);
}

// ---------------------------------------------------------------- SCREENS
function pauseGame() {
  if (game.mode !== 'playing' || game.phase === 'dead') return;
  game.mode = 'paused';
  weaponState.triggerHeld = false;
  weaponState.triggerPressed = false;
  input.fire = false;
  input.aim = false;
  keys.clear();
  ui.pause.classList.remove('hidden');
  ui.touchControls.classList.add('hidden');
  ui.lockHint.classList.add('hidden');
  ui.pauseWave.textContent = `${pad(game.wave || 1)} / ${pad(TOTAL_WAVES)}`;
  ui.pauseKills.textContent = game.kills;
  ui.pauseAccuracy.textContent = `${game.shots > 0 ? Math.round((game.hits / game.shots) * 100) : 0}%`;
  ui.pauseScore.textContent = game.score.toLocaleString('en-US');
  if (document.pointerLockElement) document.exitPointerLock();
  audio.ui();
}

function resumeGame() {
  if (game.mode !== 'paused') return;
  game.mode = 'playing';
  ui.pause.classList.add('hidden');
  if (IS_TOUCH) ui.touchControls.classList.remove('hidden');
  requestPointerLock();
  audio.resume();
}

function deployMission() {
  audio.init();
  audio.resume();
  audio.startAmbient();
  startMission();
  requestPointerLock();
  setTimeout(() => {
    if (game.mode === 'playing' && !IS_TOUCH && document.pointerLockElement !== canvas) {
      ui.lockHint.classList.remove('hidden');
    }
  }, 700);
}

function returnToMenu() {
  if (document.pointerLockElement) document.exitPointerLock();
  clearBattle();
  clearCombatText();
  game.mode = 'menu';
  game.phase = 'idle';
  game.started = false;
  ui.end.classList.add('hidden');
  ui.pause.classList.add('hidden');
  ui.manual.classList.add('hidden');
  ui.hud.classList.add('hidden');
  ui.touchControls.classList.add('hidden');
  ui.lockHint.classList.add('hidden');
  ui.menu.classList.remove('hidden');
  ui.menu.style.opacity = '';
  weaponSystem.root.visible = false;
  refreshBestStats();
  if (IS_TOUCH) ui.touchControls.classList.add('hidden');
  audio.ui();
}

function openManual() {
  ui.manual.classList.remove('hidden');
  audio.ui();
}
function closeManual() {
  ui.manual.classList.add('hidden');
  audio.ui();
}

function toggleMute() {
  settings.muted = !settings.muted;
  audio.setMuted(settings.muted);
  ui.soundToggle.checked = !settings.muted;
  saveSettings();
  showToast(settings.muted ? 'AUDIO MUTED' : 'AUDIO ONLINE');
}

function setupScreens() {
  $('deployBtn').addEventListener('click', deployMission);
  $('manualBtn').addEventListener('click', openManual);
  $('manualClose').addEventListener('click', closeManual);
  $('resumeBtn').addEventListener('click', resumeGame);
  $('restartBtn').addEventListener('click', () => {
    ui.pause.classList.add('hidden');
    startMission();
    requestPointerLock();
  });
  $('abortBtn').addEventListener('click', returnToMenu);
  $('redeployBtn').addEventListener('click', () => {
    ui.end.classList.add('hidden');
    startMission();
    requestPointerLock();
  });
  $('menuBtn').addEventListener('click', returnToMenu);

  document.querySelectorAll('[data-difficulty]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.difficulty === settings.difficulty);
    btn.addEventListener('click', () => {
      settings.difficulty = btn.dataset.difficulty;
      game.difficulty = settings.difficulty;
      document.querySelectorAll('[data-difficulty]').forEach((b) => b.classList.toggle('active', b === btn));
      ui.difficultyDesc.textContent = DIFFICULTIES[settings.difficulty].desc;
      saveSettings();
      audio.init();
      audio.ui();
    });
  });

  ui.sensRange.value = settings.sensitivity;
  ui.sensValue.textContent = Number(settings.sensitivity).toFixed(2);
  ui.sensRange.addEventListener('input', () => {
    settings.sensitivity = Number(ui.sensRange.value);
    ui.sensValue.textContent = settings.sensitivity.toFixed(2);
    saveSettings();
  });
  ui.invertToggle.checked = settings.invertY;
  ui.invertToggle.addEventListener('change', () => {
    settings.invertY = ui.invertToggle.checked;
    saveSettings();
  });
  ui.soundToggle.checked = !settings.muted;
  ui.soundToggle.addEventListener('change', () => {
    settings.muted = !ui.soundToggle.checked;
    audio.setMuted(settings.muted);
    saveSettings();
  });

  ui.manual.addEventListener('click', (e) => {
    if (e.target === ui.manual) closeManual();
  });
}

// ---------------------------------------------------------------- MINIMAP
function drawMinimap() {
  const canvas = ui.minimap;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const C = W / 2;
  const scale = 3.15;
  const radius = 33;
  ctx.clearRect(0, 0, W, W);
  ctx.save();
  ctx.beginPath();
  ctx.arc(C, C, C - 7, 0, Math.PI * 2);
  ctx.clip();

  const bg = ctx.createRadialGradient(C, C, 8, C, C, C);
  bg.addColorStop(0, 'rgba(14,23,21,0.9)');
  bg.addColorStop(1, 'rgba(5,9,9,0.95)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, W);

  // Grid sweep
  ctx.strokeStyle = 'rgba(176,220,180,0.08)';
  ctx.lineWidth = 1;
  for (let r = 12; r <= 30; r += 9) {
    ctx.beginPath();
    ctx.arc(C, C, r * scale, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(C, 10);
  ctx.lineTo(C, W - 10);
  ctx.moveTo(10, C);
  ctx.lineTo(W - 10, C);
  ctx.strokeStyle = 'rgba(176,220,180,0.07)';
  ctx.stroke();

  // Static cover geometry
  ctx.fillStyle = 'rgba(174,195,178,0.18)';
  ctx.strokeStyle = 'rgba(174,195,178,0.18)';
  for (const c of world.colliders) {
    const cw = c.maxX - c.minX;
    const cd = c.maxZ - c.minZ;
    if (cw > 40 || cd > 40) continue;
    const cx = (c.minX + c.maxX) / 2;
    const cz = (c.minZ + c.maxZ) / 2;
    const dx = (cx - player.pos.x) * scale;
    const dz = (cz - player.pos.z) * scale;
    if (Math.abs(dx) > C + 20 || Math.abs(dz) > C + 20) continue;
    ctx.fillRect(C + dx - (cw * scale) / 2, C + dz - (cd * scale) / 2, cw * scale, cd * scale);
  }

  // Objective beacon
  const ox = (world.uplink.position.x - player.pos.x) * scale;
  const oz = (world.uplink.position.z - player.pos.z) * scale;
  const od = Math.hypot(ox, oz);
  const oMax = C - 18;
  const clampedOx = od > oMax ? (ox / od) * oMax : ox;
  const clampedOz = od > oMax ? (oz / od) * oMax : oz;
  ctx.strokeStyle = 'rgba(136,255,150,0.65)';
  ctx.fillStyle = 'rgba(136,255,150,0.15)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(C + clampedOx, C + clampedOz, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(173,255,178,0.9)';
  ctx.fillRect(C + clampedOx - 1, C + clampedOz - 5, 2, 10);
  ctx.fillRect(C + clampedOx - 5, C + clampedOz - 1, 10, 2);

  // Pickups
  for (const p of pickups) {
    const dx = (p.group.position.x - player.pos.x) * scale;
    const dz = (p.group.position.z - player.pos.z) * scale;
    if (Math.hypot(dx, dz) > C - 12) continue;
    ctx.fillStyle = p.type === 'health' ? 'rgba(138,255,146,0.85)' : 'rgba(255,203,94,0.9)';
    ctx.fillRect(C + dx - 2, C + dz - 2, 4, 4);
  }

  // Hostiles
  for (const e of enemies) {
    if (e.dead) continue;
    const dx = (e.group.position.x - player.pos.x) * scale;
    const dz = (e.group.position.z - player.pos.z) * scale;
    const dist = Math.hypot(dx, dz);
    if (dist > C - 11) continue;
    const pulse = 0.72 + Math.sin(performance.now() * 0.006 + e.walkPhase) * 0.2;
    ctx.fillStyle = e.heavy ? `rgba(255,74,48,${pulse})` : `rgba(255,95,62,${pulse})`;
    ctx.beginPath();
    ctx.arc(C + dx, C + dz, e.heavy ? 4.6 : 2.9, 0, Math.PI * 2);
    ctx.fill();
    if (e.heavy) {
      ctx.strokeStyle = 'rgba(255,95,62,0.45)';
      ctx.beginPath();
      ctx.arc(C + dx, C + dz, 7.5 + Math.sin(performance.now() * 0.004) * 1.2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Player FOV cone and chevron
  const heading = -player.yaw;
  ctx.save();
  ctx.translate(C, C);
  ctx.rotate(heading);
  const cone = ctx.createLinearGradient(0, 0, 0, -72);
  cone.addColorStop(0, 'rgba(216,246,109,0.17)');
  cone.addColorStop(1, 'rgba(216,246,109,0)');
  ctx.fillStyle = cone;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-38, -76);
  ctx.lineTo(38, -76);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, -9);
  ctx.lineTo(6, 6);
  ctx.lineTo(0, 3);
  ctx.lineTo(-6, 6);
  ctx.closePath();
  ctx.fillStyle = '#e7ff9f';
  ctx.fill();
  ctx.restore();

  // North mark
  ctx.fillStyle = 'rgba(216,246,109,0.7)';
  ctx.font = '700 9px Rajdhani, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('N', C, 18);

  // Edge notch
  ctx.strokeStyle = 'rgba(216,246,109,0.32)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    ctx.beginPath();
    ctx.moveTo(C + Math.cos(a) * (C - 8), C + Math.sin(a) * (C - 8));
    ctx.lineTo(C + Math.cos(a) * (C - 13), C + Math.sin(a) * (C - 13));
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- HUD UPDATE
function updateHud(dt) {
  game.hudRefresh -= dt;
  game.minimapRefresh -= dt;
  updateCompass();

  if (game.hudRefresh <= 0) {
    game.hudRefresh = 0.12;
    updateHealthHud();
    ui.missionTimer.textContent = formatTime(game.missionTime);
    const lights = weaponState.current;
    if (ui.ammoMag.textContent !== pad(lights.ammo)) updateAmmoHud();
    if (weaponState.reloading) {
      ui.reloadState.textContent = 'RELOADING';
    } else if (lights.ammo === 0) {
      ui.reloadState.textContent = 'MAG EMPTY';
    } else {
      ui.reloadState.textContent = '';
    }
  }

  if (game.minimapRefresh <= 0) {
    game.minimapRefresh = 0.11;
    drawMinimap();
    const north = Math.round(((-THREE.MathUtils.radToDeg(player.yaw) + 360) % 360));
    const east = Math.round(((THREE.MathUtils.radToDeg(player.yaw) + 90 + 360) % 360));
    ui.minimapCoords.textContent = `HDG ${pad(north, 3)} // ${pad(east, 3)}`;
  }
}

function updateEffects(dt) {
  dustParticles.update(dt);
  sparkParticles.update(dt);
  bloodParticles.update(dt);
  tracers.update(dt);
  updateShockwaves(dt);
  updateExplosionLights(dt);
}

// ---------------------------------------------------------------- LOOP
const clock = new THREE.Clock();
let menuTime = 0;

function updateMenuCamera(dt, time) {
  menuTime += dt;
  const x = 14.2 + Math.sin(time * 0.07) * 0.85;
  const y = 7.1 + Math.sin(time * 0.11 + 1.2) * 0.2;
  const z = 24 + Math.sin(time * 0.055) * 0.5;
  camera.position.set(x, y, z);
  camera.lookAt(-1.3, 2.15 + Math.sin(time * 0.08) * 0.08, -5.4);
  camera.fov = damp(camera.fov, 52, 3, dt);
  camera.updateProjectionMatrix();
}

function updateMission(dt, time) {
  if (game.phase !== 'dead' && game.phase !== 'idle') game.missionTime += dt;

  updatePlayer(dt);
  updateWeapon(dt);

  if (canShoot() && (weaponState.triggerHeld || weaponState.triggerPressed)) fireWeapon();
  weaponState.triggerPressed = false;

  updateEnemies(dt);
  updateWaves(dt);
  updateGrenades(dt);
  updatePickups(dt, time);
  updateEffects(dt);
  updateHud(dt);

  if (ui.lockHint && document.pointerLockElement === canvas) ui.lockHint.classList.add('hidden');
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  if (game.mode === 'menu') {
    updateMenuCamera(dt, time);
    dustParticles.update(dt);
    sparkParticles.update(dt);
    updateShockwaves(dt);
    world.update(dt, time, camera.position);
  } else if (game.mode === 'playing') {
    updateMission(dt, time);
    world.update(dt, time, player.pos);
  } else if (game.mode === 'paused') {
    world.update(dt, time, player.pos);
  } else {
    world.update(dt, time, player.pos);
  }

  renderer.render(scene, camera);
}

// ---------------------------------------------------------------- BOOT
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, IS_TOUCH ? 1.35 : 1.6));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function boot() {
  refreshBestStats();
  buildCompass();
  buildAmmoBars();
  buildWavePips();
  setupScreens();
  setupInput();
  setupTouch();
  updateWeaponHud();
  updateGrenadeHud();
  updateHealthHud();

  ui.loaderStatus.textContent = 'BUILDING TACTICAL RUNTIME';
  ui.loaderPct.textContent = '18';
  ui.loaderBar.style.width = '18%';

  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 150));

  if (IS_TOUCH) {
    ui.touchControls.classList.add('hidden');
    document.documentElement.classList.add('touch-device');
  }

  // Short, deterministic boot sequence so the environment is warm before play.
  let pct = 18;
  const bootTimer = setInterval(() => {
    pct = Math.min(96, pct + 7 + Math.random() * 8);
    ui.loaderPct.textContent = pad(Math.floor(pct));
    ui.loaderBar.style.width = `${pct}%`;
    if (pct > 60) ui.loaderStatus.textContent = 'COMPILING LIGHTING // CALIBRATING WEAPONS';
  }, 130);

  setTimeout(() => {
    clearInterval(bootTimer);
    pct = 100;
    ui.loaderPct.textContent = '100';
    ui.loaderBar.style.width = '100%';
    ui.loaderStatus.textContent = 'RUNTIME READY';
    setTimeout(() => {
      ui.loader.classList.add('done');
      if (game.mode === 'menu') ui.menu.classList.remove('hidden');
    }, 380);
  }, 1500);

  // Pre-render the menu once so the first visible frame is fully composed.
  updateMenuCamera(0.016, 0);
  world.update(0.016, 0, camera.position);
  renderer.compile(scene, camera);
  renderer.render(scene, camera);
  animate();
}

boot();

// Small hook used by automated visual checks and curious operators.
window.brokenLine = {
  game,
  player,
  renderer,
  scene,
  camera,
  world,
  startMission,
  deployMission,
  pauseGame,
  resumeGame,
  returnToMenu,
  fireWeapon,
  spawnEnemy,
  startWave,
  onWaveCleared,
  endMission,
  damageEnemy,
  simulate(seconds, step = 1 / 60) {
    const count = Math.max(1, Math.round(seconds / step));
    for (let i = 0; i < count; i++) updateMission(step, clock.elapsedTime + i * step);
    return { health: game.health, phase: game.phase, enemies: aliveEnemies(), kills: game.kills };
  },
  get enemies() { return enemies; },
  get pickups() { return pickups; },
};

