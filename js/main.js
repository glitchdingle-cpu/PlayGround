// Everwild — game bootstrap, player controller, HUD, time-of-day, discovery loop
import * as THREE from './vendor/three.module.js';
import {
  WATER_LEVEL, WORLD_HALF, terrainHeight, makeHeightTexture, skyPalette,
  buildTerrain, buildSky, buildWater, buildForest, buildLandmarks, tickWind,
} from './world.js';
import { clamp, lerp, fbm2 } from './noise.js';
import { ambience } from './audio.js';

/* ============================================================
   RENDERER / SCENE / CAMERA
   ============================================================ */
const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x9fb3bd, 110, 430);

const camera = new THREE.PerspectiveCamera(66, window.innerWidth / window.innerHeight, 0.08, 900);
camera.rotation.order = 'YXZ';

/* Lights */
const sunLight = new THREE.DirectionalLight(0xffffff, 2.2);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.left = -70;
sunLight.shadow.camera.right = 70;
sunLight.shadow.camera.top = 70;
sunLight.shadow.camera.bottom = -70;
sunLight.shadow.camera.near = 10;
sunLight.shadow.camera.far = 380;
sunLight.shadow.bias = -0.00045;
sunLight.shadow.normalBias = 0.35;
scene.add(sunLight);
scene.add(sunLight.target);

const hemi = new THREE.HemisphereLight(0xbcd6e8, 0x2c3a28, 0.6);
scene.add(hemi);

/* Build the world */
const heightTex = makeHeightTexture(256);
buildTerrain(scene);
const sky = buildSky(scene);
const water = buildWater(scene, heightTex);
const lm = buildLandmarks(scene);
lm.clearings.push({ x: 0, z: 128, r: 12 });   // spawn vista clearing
buildForest(scene, lm.clearings);

/* ============================================================
   PLAYER STATE
   ============================================================ */
const EYE = 1.68;
const player = {
  pos: new THREE.Vector3(0, 0, 128),
  vel: new THREE.Vector3(),
  yaw: 0,           // rotation.y — 0 faces north (-z)
  pitch: 0,
  vy: 0,
  grounded: true,
  stamina: 100,
  bobPhase: 0,
  lastBobSign: 1,
};
player.pos.y = terrainHeight(player.pos.x, player.pos.z);

const keys = new Set();
let playing = false;
let startTime = 0;
let elapsedAtComplete = 0;
const discovered = new Set();
try {
  const saved = JSON.parse(localStorage.getItem('everwild-discovered') || '[]');
  for (const id of saved) discovered.add(id);
} catch { /* fresh start */ }

const landmarks = lm.landmarks;
for (const l of landmarks) {
  if (discovered.has(l.id) && l.beam) l.beam.visible = false;
}

/* ============================================================
   HUD REFERENCES
   ============================================================ */
const hud = document.getElementById('hud');
const compassCanvas = document.getElementById('compass');
const compassCtx = compassCanvas.getContext('2d');
const minimapCanvas = document.getElementById('minimap');
const minimapCtx = minimapCanvas.getContext('2d');
const lmCountEl = document.getElementById('lm-count');
const staminaWrap = document.getElementById('stamina-wrap');
const staminaBar = document.getElementById('stamina-bar');
const toastEl = document.getElementById('toast');
const toastName = document.getElementById('toast-name');
const objectiveEl = document.getElementById('objective');

/* ============================================================
   MINIMAP — pre-rendered relief map + dynamic markers
   ============================================================ */
const MAP_RES = 184;
const mapBase = document.createElement('canvas');
mapBase.width = mapBase.height = MAP_RES;
(function renderMapBase() {
  const ctx = mapBase.getContext('2d');
  const img = ctx.createImageData(MAP_RES, MAP_RES);
  for (let j = 0; j < MAP_RES; j++) {
    for (let i = 0; i < MAP_RES; i++) {
      const x = (i / (MAP_RES - 1) - 0.5) * WORLD_HALF * 2;
      const z = (j / (MAP_RES - 1) - 0.5) * WORLD_HALF * 2;
      const h = terrainHeight(x, z);
      let r, g, b;
      if (h < WATER_LEVEL) {
        const d = clamp(-h / 14, 0, 1);
        r = lerp(52, 8, d); g = lerp(116, 38, d); b = lerp(138, 66, d);
      } else if (h < 1.6) {
        r = 178; g = 165; b = 126;
      } else if (h > 58) {
        const t = clamp((h - 58) / 18, 0, 1);
        r = lerp(120, 244, t); g = lerp(116, 246, t); b = lerp(110, 250, t);
      } else if (h > 40) {
        const t = clamp((h - 40) / 18, 0, 1);
        r = lerp(96, 126, t); g = lerp(110, 120, t); b = lerp(70, 112, t);
      } else {
        const n = fbm2(x * 0.05, z * 0.05, 2) * 0.5 + 0.5;
        r = lerp(48, 84, n); g = lerp(88, 128, n); b = lerp(44, 62, n);
      }
      const k = (j * MAP_RES + i) * 4;
      img.data[k] = r; img.data[k + 1] = g; img.data[k + 2] = b; img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
})();

function worldToMap(x, z) {
  return [
    (x / (WORLD_HALF * 2) + 0.5) * MAP_RES,
    (z / (WORLD_HALF * 2) + 0.5) * MAP_RES,
  ];
}

function drawMinimap(forwardX, forwardZ) {
  const ctx = minimapCtx;
  ctx.clearRect(0, 0, MAP_RES, MAP_RES);
  ctx.drawImage(mapBase, 0, 0);
  // vignette ring
  ctx.strokeStyle = 'rgba(224,178,90,0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, MAP_RES - 2, MAP_RES - 2);

  // Discovered landmarks
  for (const l of landmarks) {
    const [mx, my] = worldToMap(l.pos.x, l.pos.z);
    if (discovered.has(l.id)) {
      ctx.fillStyle = '#ffd98a';
      ctx.beginPath();
      ctx.moveTo(mx, my - 4.5); ctx.lineTo(mx + 4.5, my); ctx.lineTo(mx, my + 4.5); ctx.lineTo(mx - 4.5, my);
      ctx.closePath(); ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.36)';
      ctx.beginPath(); ctx.arc(mx, my, 2.4, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Player arrow
  const [px, py] = worldToMap(player.pos.x, player.pos.z);
  const ang = Math.atan2(forwardX, -forwardZ); // 0 = up(north)
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(ang);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = 'rgba(0,0,0,0.75)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(0, -6.5); ctx.lineTo(4.6, 5); ctx.lineTo(0, 2.6); ctx.lineTo(-4.6, 5);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.restore();
}

/* ============================================================
   COMPASS RIBBON
   ============================================================ */
const CARDINALS = [
  { label: 'N', ang: 0, main: true },
  { label: 'NE', ang: Math.PI / 4 },
  { label: 'E', ang: Math.PI / 2, main: true },
  { label: 'SE', ang: (3 * Math.PI) / 4 },
  { label: 'S', ang: Math.PI, main: true },
  { label: 'SW', ang: (5 * Math.PI) / 4 },
  { label: 'W', ang: (3 * Math.PI) / 2, main: true },
  { label: 'NW', ang: (7 * Math.PI) / 4 },
];
const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a));

function drawCompass(heading) {
  const ctx = compassCtx;
  const W = compassCanvas.width, H = compassCanvas.height;
  ctx.clearRect(0, 0, W, H);
  const span = Math.PI * 0.75; // visible half-width in radians
  const pxPerRad = W / (span * 2);

  // degree ticks
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '10px system-ui';
  ctx.textAlign = 'center';
  for (let deg = 0; deg < 360; deg += 15) {
    const bearing = (deg * Math.PI) / 180;        // 0 = north, clockwise
    const offset = wrapPi(bearing - heading);
    const x = W / 2 + offset * pxPerRad;
    if (x < 8 || x > W - 8) continue;
    const isMain = deg % 45 === 0;
    ctx.globalAlpha = isMain ? 0.9 : 0.5;
    ctx.beginPath();
    ctx.moveTo(x, H - (isMain ? 16 : 10));
    ctx.lineTo(x, H - 4);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // cardinal letters
  for (const c of CARDINALS) {
    const offset = wrapPi(c.ang - heading);
    if (Math.abs(offset) > span) continue;
    const x = W / 2 + offset * pxPerRad;
    ctx.font = c.main ? 'bold 17px Georgia, serif' : '12px Georgia, serif';
    ctx.fillStyle = c.label === 'N' ? '#ffd98a' : 'rgba(238,242,230,0.9)';
    ctx.textAlign = 'center';
    ctx.fillText(c.label, x, c.main ? 22 : 19);
  }

  // discovered landmark diamonds (gold) & undiscovered (faint "?")
  for (const l of landmarks) {
    const dx = l.pos.x - player.pos.x, dz = l.pos.z - player.pos.z;
    // world bearing: 0 = north (-z), clockwise
    const bearing = Math.atan2(dx, -dz);
    const offset = wrapPi(bearing - heading);
    if (Math.abs(offset) > span) continue;
    const x = W / 2 + offset * pxPerRad;
    if (discovered.has(l.id)) {
      ctx.fillStyle = '#ffd98a';
      ctx.beginPath();
      ctx.moveTo(x, 33); ctx.lineTo(x + 4.5, 38.5); ctx.lineTo(x, 44); ctx.lineTo(x - 4.5, 38.5);
      ctx.closePath(); ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.font = '10px system-ui';
      ctx.fillText('?', x, 42);
    }
  }

  // center needle
  ctx.fillStyle = '#e0b25a';
  ctx.beginPath();
  ctx.moveTo(W / 2, 2); ctx.lineTo(W / 2 + 5, 9); ctx.lineTo(W / 2 - 5, 9);
  ctx.closePath(); ctx.fill();
}

/* heading: radians clockwise from north, derived from camera forward */
function currentHeading(forward) {
  return Math.atan2(forward.x, -forward.z);
}

/* ============================================================
   TOASTS / COMPLETION
   ============================================================ */
let toastTimeout = null;
function showToast(name) {
  toastName.textContent = name;
  toastEl.classList.remove('hidden');
  // force reflow so the transition replays
  void toastEl.offsetWidth;
  toastEl.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toastEl.classList.remove('show'), 4200);
}

function updateLandmarkCounter() {
  lmCountEl.textContent = String(discovered.size);
  if (discovered.size >= landmarks.length) {
    objectiveEl.textContent = 'The forest is yours — wander freely';
  } else {
    objectiveEl.textContent = `Explore the Everwild — ${landmarks.length - discovered.size} landmark${landmarks.length - discovered.size === 1 ? '' : 's'} remain`;
  }
}

function saveProgress() {
  try { localStorage.setItem('everwild-discovered', JSON.stringify([...discovered])); } catch { /* private mode */ }
}

function discoverLandmark(l) {
  if (discovered.has(l.id)) return;
  discovered.add(l.id);
  if (l.beam) l.beam.visible = false;
  saveProgress();
  updateLandmarkCounter();
  showToast(l.name);
  if (discovered.size >= landmarks.length) {
    elapsedAtComplete = performance.now() - startTime;
    setTimeout(showCompletion, 1900);
  }
}

function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const banner = document.getElementById('banner');
function showCompletion() {
  document.getElementById('banner-time').textContent = formatTime(elapsedAtComplete);
  banner.classList.remove('hidden');
  if (document.pointerLockElement) document.exitPointerLock();
}

document.getElementById('btn-keep-wandering').addEventListener('click', () => {
  banner.classList.add('hidden');
});
document.getElementById('btn-restart').addEventListener('click', () => {
  try { localStorage.removeItem('everwild-discovered'); } catch { /* ignore */ }
  window.location.reload();
});

/* ============================================================
   TIME OF DAY
   ============================================================ */
const TIME_PRESETS = [
  { name: 'Golden Hour', tod: 17.35, icon: '🌇' },
  { name: 'High Noon', tod: 12.4, icon: '☀️' },
  { name: 'Dusk', tod: 19.15, icon: '🌆' },
  { name: 'Night', tod: 0.2, icon: '🌙' },
];
let timeIndex = 0;
let tod = TIME_PRESETS[0].tod;
let todTarget = tod;
const btnTime = document.getElementById('btn-time');

function cycleTime() {
  timeIndex = (timeIndex + 1) % TIME_PRESETS.length;
  todTarget = TIME_PRESETS[timeIndex].tod;
  btnTime.textContent = TIME_PRESETS[timeIndex].icon;
}
btnTime.addEventListener('click', cycleTime);

function advanceTimeOfDay(dt) {
  if (Math.abs(tod - todTarget) > 0.005) {
    let diff = todTarget - tod;
    // wrap around midnight for shortest path
    if (diff > 12) diff -= 24;
    if (diff < -12) diff += 24;
    const step = Math.sign(diff) * Math.min(Math.abs(diff), dt * 3.2);
    tod = (tod + step + 24) % 24;
  }
}

const _sunDir = new THREE.Vector3();
const _moonDir = new THREE.Vector3();
const _fogColor = new THREE.Color();

function applyTimeOfDay() {
  const dayT = (tod - 6) / 12;               // 0 at sunrise, 1 at sunset, >1 or <0 at night
  const az = dayT * Math.PI;
  const elev = Math.sin(az);                  // raw sun height -1..1
  _sunDir.set(Math.cos(az), Math.sin(az), 0.42).normalize();
  _moonDir.copy(_sunDir).negate();

  const pal = skyPalette(elev);

  // directional light — sun by day, moon by night
  const useMoon = elev < -0.02;
  const lightDir = useMoon ? _moonDir : _sunDir;
  sunLight.position.copy(player.pos).addScaledVector(lightDir, 170);
  sunLight.target.position.copy(player.pos);
  sunLight.color.setRGB(pal.dirColor[0], pal.dirColor[1], pal.dirColor[2]);
  if (useMoon) {
    sunLight.intensity = 0.55;
  } else {
    sunLight.intensity = pal.sunIntensity;
  }

  hemi.intensity = pal.hemiIntensity;
  hemi.color.setRGB(
    lerp(0.75, pal.zenith[0] + 0.35, 0.55),
    lerp(0.85, pal.zenith[1] + 0.35, 0.55),
    lerp(0.95, pal.zenith[2] + 0.35, 0.55),
  );
  hemi.groundColor.setRGB(0.16, 0.22, 0.14);

  _fogColor.setRGB(pal.fog[0], pal.fog[1], pal.fog[2]);
  scene.fog.color.copy(_fogColor);

  // sky
  sky.uniforms.uSunDir.value.copy(_sunDir);
  sky.uniforms.uNight.value = pal.nightF;
  sky.uniforms.uGold.value = pal.goldF;

  // water
  water.uniforms.uSunDir.value.copy(_sunDir);
  water.uniforms.uMoonDir.value.copy(_moonDir);
  water.uniforms.uZenith.value.set(pal.zenith[0], pal.zenith[1], pal.zenith[2]);
  water.uniforms.uHorizon.value.set(pal.horizon[0], pal.horizon[1], pal.horizon[2]);
  water.uniforms.uSunTint.value.set(pal.sunTint[0], pal.sunTint[1], pal.sunTint[2]);
  water.uniforms.uSunSpec.value = clamp(elev * 2.2 + 0.35, 0.0, 1.15);
  water.uniforms.uNight.value = pal.nightF;
  water.uniforms.uFogColor.value.copy(_fogColor);

  ambience.setNight(pal.nightF);
  renderer.toneMappingExposure = lerp(1.14, 0.92, pal.nightF);
}

/* ============================================================
   INPUT — desktop (pointer lock) + touch
   ============================================================ */
const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

const startOverlay = document.getElementById('start-overlay');
const pauseOverlay = document.getElementById('pause-overlay');
const btnBegin = document.getElementById('btn-begin');
const touchUI = document.getElementById('touch-ui');

if (isTouchDevice) {
  document.getElementById('controls-desktop').classList.add('hidden');
  document.getElementById('controls-touch').classList.remove('hidden');
  btnBegin.textContent = 'Tap to Explore';
}

function beginGame() {
  startOverlay.classList.add('hidden');
  hud.classList.remove('hidden');
  playing = true;
  startTime = performance.now();
  ambience.start();
  updateLandmarkCounter();
  if (isTouchDevice) {
    touchUI.classList.remove('hidden');
  } else {
    canvas.requestPointerLock?.();
  }
}
btnBegin.addEventListener('click', beginGame);

/* Pause handling */
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  if (!locked && playing && !isTouchDevice && banner.classList.contains('hidden')) {
    pauseOverlay.classList.remove('hidden');
  }
});
document.getElementById('btn-resume').addEventListener('click', () => {
  pauseOverlay.classList.add('hidden');
  canvas.requestPointerLock?.();
});
pauseOverlay.addEventListener('click', (e) => {
  if (e.target === pauseOverlay) {
    pauseOverlay.classList.add('hidden');
    canvas.requestPointerLock?.();
  }
});

/* Mouse look */
let lastMouseMove = 0;
document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== canvas) return;
  const now = performance.now();
  if (now - lastMouseMove < 1) return;
  lastMouseMove = now;
  const sens = 0.00215;
  player.yaw -= e.movementX * sens;
  player.pitch = clamp(player.pitch - e.movementY * sens, -1.45, 1.45);
});

/* Keyboard */
const RUN_KEYS = new Set(['ShiftLeft', 'ShiftRight']);
document.addEventListener('keydown', (e) => {
  if (e.code === 'KeyM') { toggleMute(); return; }
  if (e.code === 'KeyC') { cycleTime(); return; }
  if (e.code === 'KeyH' && !startOverlay.classList.contains('hidden')) return;
  if (e.code === 'Space') e.preventDefault();
  keys.add(e.code);
  if (e.code === 'Space') tryJump();
});
document.addEventListener('keyup', (e) => keys.delete(e.code));

/* Touch: left-half joystick + right-half look drag */
const joyZone = document.getElementById('joy-zone');
const joyBase = document.getElementById('joy-base');
const joyKnob = document.getElementById('joy-knob');
const btnRun = document.getElementById('btn-run');
const btnJump = document.getElementById('btn-jump');
let joyActive = false, joyId = -1, joyCenter = { x: 0, y: 0 }, joyVec = { x: 0, y: 0 };
let runToggled = false;
let lookId = -1, lookLast = { x: 0, y: 0 };

btnRun.addEventListener('click', () => {
  runToggled = !runToggled;
  btnRun.setAttribute('aria-pressed', String(runToggled));
});
btnJump.addEventListener('click', tryJump);

joyZone.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const t = e.changedTouches[0];
  joyActive = true;
  joyId = t.identifier;
  joyCenter = { x: t.clientX, y: t.clientY };
  joyVec = { x: 0, y: 0 };
  joyBase.style.display = 'block';
  joyBase.style.left = `${t.clientX - 59}px`;
  joyBase.style.top = `${t.clientY - 59}px`;
  joyKnob.style.transform = 'translate(0px, 0px)';
}, { passive: false });

joyZone.addEventListener('touchmove', (e) => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (t.identifier !== joyId) continue;
    let dx = t.clientX - joyCenter.x, dy = t.clientY - joyCenter.y;
    const len = Math.hypot(dx, dy);
    const max = 52;
    if (len > max) { dx = (dx / len) * max; dy = (dy / len) * max; }
    joyVec = { x: dx / max, y: dy / max };
    joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
  }
}, { passive: false });

const joyEnd = (e) => {
  for (const t of e.changedTouches) {
    if (t.identifier === joyId) {
      joyActive = false; joyId = -1; joyVec = { x: 0, y: 0 };
      joyBase.style.display = 'none';
    }
  }
};
joyZone.addEventListener('touchend', joyEnd);
joyZone.addEventListener('touchcancel', joyEnd);

/* Look drag — anywhere on the right half of the screen */
canvas.addEventListener('touchstart', (e) => {
  for (const t of e.changedTouches) {
    if (t.clientX > window.innerWidth * 0.42 && lookId === -1) {
      lookId = t.identifier;
      lookLast = { x: t.clientX, y: t.clientY };
    }
  }
}, { passive: true });
canvas.addEventListener('touchmove', (e) => {
  for (const t of e.changedTouches) {
    if (t.identifier !== lookId) continue;
    const dx = t.clientX - lookLast.x, dy = t.clientY - lookLast.y;
    lookLast = { x: t.clientX, y: t.clientY };
    player.yaw -= dx * 0.0042;
    player.pitch = clamp(player.pitch - dy * 0.0042, -1.45, 1.45);
  }
  e.preventDefault();
}, { passive: false });
const lookEnd = (e) => {
  for (const t of e.changedTouches) if (t.identifier === lookId) lookId = -1;
};
canvas.addEventListener('touchend', lookEnd);
canvas.addEventListener('touchcancel', lookEnd);

/* Buttons */
const btnMute = document.getElementById('btn-mute');
function toggleMute() {
  const muted = ambience.toggleMute();
  btnMute.textContent = muted ? '🔇' : '🔊';
}
btnMute.addEventListener('click', toggleMute);
document.getElementById('btn-help').addEventListener('click', () => {
  if (!playing) return;
  if (isTouchDevice) {
    touchUI.classList.toggle('hidden');
  } else if (document.pointerLockElement === canvas) {
    document.exitPointerLock();
  } else {
    pauseOverlay.classList.toggle('hidden');
  }
});

/* ============================================================
   PHYSICS & MOVEMENT
   ============================================================ */
function tryJump() {
  if (!playing) return;
  if (player.grounded) {
    player.vy = 7.6;
    player.grounded = false;
  }
}

const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _move = new THREE.Vector3();
const GRAVITY = 23;

function updatePlayer(dt) {
  camera.rotation.y = player.yaw;
  camera.rotation.x = player.pitch;
  camera.getWorldDirection(_forward);
  _forward.y = 0;
  const fLen = _forward.length();
  if (fLen > 0.001) _forward.normalize();
  _right.set(-_forward.z, 0, _forward.x);

  // Input vector
  let ix = 0, iz = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) iz += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) iz -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) ix += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) ix -= 1;
  if (joyActive) { ix += joyVec.x; iz -= joyVec.y; }

  const inputLen = Math.hypot(ix, iz);
  const wantsMove = inputLen > 0.08;
  const anyRunKey = [...RUN_KEYS].some(k => keys.has(k));
  const wantsRun = isTouchDevice ? runToggled : anyRunKey;

  const groundH = terrainHeight(player.pos.x, player.pos.z);
  const inDeepWater = groundH < WATER_LEVEL - 1.15;
  const inShallow = groundH < WATER_LEVEL + 0.15 && !inDeepWater;

  // Stamina & sprint
  let sprint = wantsRun && wantsMove && player.stamina > 1 && !inDeepWater;
  if (sprint) player.stamina = Math.max(0, player.stamina - 17 * dt);
  else player.stamina = Math.min(100, player.stamina + 13.5 * dt);

  let speed = inDeepWater ? 3.1 : 5.6;
  if (sprint) speed = 8.4;
  if (inShallow) speed *= 0.66;

  _move.set(0, 0, 0);
  if (wantsMove) {
    const norm = Math.min(1, inputLen);
    _move.addScaledVector(_forward, iz).addScaledVector(_right, ix);
    if (_move.lengthSq() > 0.0001) _move.normalize().multiplyScalar(speed * norm);
  }

  // Smooth accelerate / decelerate
  const accel = player.grounded || inDeepWater ? 11 : 4.2;
  player.vel.x = lerp(player.vel.x, _move.x, clamp(accel * dt, 0, 1));
  player.vel.z = lerp(player.vel.z, _move.z, clamp(accel * dt, 0, 1));

  // Vertical
  if (inDeepWater) {
    // swim — float at the surface with a gentle bob
    const swimY = WATER_LEVEL + 0.62 + Math.sin(performance.now() * 0.0016) * 0.09;
    player.pos.y = lerp(player.pos.y, swimY - EYE + 1.0, clamp(3.2 * dt, 0, 1));
    player.vy = 0;
    player.grounded = false;
  } else {
    player.vy -= GRAVITY * dt;
    player.pos.y += player.vy * dt;
    const restY = groundH + EYE;
    if (player.pos.y <= restY) {
      if (!player.grounded && player.vy < -11) ambience.footstep(1); // land thump
      player.pos.y = restY;
      player.vy = 0;
      player.grounded = true;
    } else if (player.pos.y > restY + 0.05) {
      player.grounded = false;
    }
  }

  player.pos.x += player.vel.x * dt;
  player.pos.z += player.vel.z * dt;

  // World border — soft cylindrical wall
  const distC = Math.hypot(player.pos.x, player.pos.z);
  const maxR = 208;
  if (distC > maxR) {
    const s = maxR / distC;
    player.pos.x *= s;
    player.pos.z *= s;
  }

  // Head bob + footsteps
  const hSpeed = Math.hypot(player.vel.x, player.vel.z);
  let bobOffset = 0;
  if (player.grounded && hSpeed > 0.6) {
    player.bobPhase += dt * (4.6 + hSpeed * 0.9);
    bobOffset = Math.sin(player.bobPhase) * 0.055 * clamp(hSpeed / 6, 0.3, 1.15);
    const sign = Math.sin(player.bobPhase) >= 0 ? 1 : -1;
    if (sign !== player.lastBobSign) {
      player.lastBobSign = sign;
      ambience.footstep(clamp(hSpeed / 8.4, 0.25, 1));
    }
  }

  camera.position.set(player.pos.x, player.pos.y + bobOffset, player.pos.z);

  // Swim camera dips slightly
  if (inDeepWater) camera.position.y = WATER_LEVEL + 0.78 + Math.sin(performance.now() * 0.0016) * 0.08;

  // HUD stamina
  staminaBar.style.width = `${player.stamina}%`;
  staminaWrap.classList.toggle('low', player.stamina < 25);
  staminaWrap.style.opacity = player.stamina > 99.5 ? '0.55' : '1';

  return _forward;
}

/* ============================================================
   DISCOVERY LOOP
   ============================================================ */
function checkDiscoveries() {
  for (const l of landmarks) {
    if (discovered.has(l.id)) continue;
    const dx = player.pos.x - l.pos.x, dz = player.pos.z - l.pos.z;
    if (dx * dx + dz * dz < l.radius * l.radius) {
      discoverLandmark(l);
    }
  }
}

/* ============================================================
   ANIMATION LOOP
   ============================================================ */
const clock = new THREE.Clock();
let elapsed = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;

  advanceTimeOfDay(dt);
  applyTimeOfDay();

  let forward = _forward;
  if (playing) {
    forward = updatePlayer(dt);
    checkDiscoveries();
  } else {
    // Menus orbit slowly around the vista for a living backdrop
    const t = elapsed * 0.05;
    camera.position.set(Math.sin(t) * 60, terrainHeight(Math.sin(t) * 60, Math.cos(t) * 60) + 26, Math.cos(t) * 60);
    camera.lookAt(0, 20, 0);
  }

  // Water + sky time
  tickWind(elapsed);
  water.uniforms.uTime.value = elapsed;
  water.uniforms.uCamPos.value.copy(camera.position);
  sky.uniforms.uTime.value = elapsed;

  // Falls + mist + fire
  lm.fallsUniforms.uTime.value = elapsed;
  for (let i = 0; i < lm.mists.length; i++) {
    const m = lm.mists[i];
    m.material.opacity = 0.38 + 0.3 * (0.5 + 0.5 * Math.sin(elapsed * 1.7 + i * 1.9));
    m.position.y = WATER_LEVEL + 0.7 + ((elapsed * 0.35 + i * 0.7) % 2.6);
  }
  lm.campfire.uniforms.uTime.value = elapsed;
  lm.campfire.light.intensity = 26 + Math.sin(elapsed * 11.3) * 5 + Math.sin(elapsed * 23.7) * 3;

  // Beams pulse
  for (const l of landmarks) {
    if (l.beam && l.beam.visible) {
      l.beam.material.opacity = 0.42 + 0.22 * Math.sin(elapsed * 1.9 + l.pos.x);
      l.beam.rotation.y = elapsed * 0.35;
    }
  }

  // Fire proximity for crackle audio
  const fdx = player.pos.x - lm.campfire.x, fdz = player.pos.z - lm.campfire.z;
  ambience.setFireProximity(clamp(1 - Math.hypot(fdx, fdz) / 16, 0, 1));

  // HUD
  if (playing) {
    camera.getWorldDirection(_forward);
    const heading = currentHeading(_forward);
    drawCompass(heading);
    drawMinimap(_forward.x, _forward.z);
  }

  renderer.render(scene, camera);
}

/* ============================================================
   RESIZE
   ============================================================ */
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener('contextmenu', (e) => e.preventDefault());

/* Boot */
updateLandmarkCounter();
applyTimeOfDay();
animate();

// Debug / automation handle (read-only diagnostics)
window.__everwild = { player, landmarks, discovered, get playing() { return playing; } };
