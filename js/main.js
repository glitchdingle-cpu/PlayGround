// IRON FRONT 1944 — boot, camera rig, input, selection, orders, main loop.
import * as THREE from 'three';
import { G, resetState } from './state.js';
import { MAP_SIZE, PLAYER_BASE, AXIS_BASE, ECONOMY, SKIRMISH_TIME, UNIT_DEFS, BUILDING_DEFS, FACTIONS } from './config.js';
import { buildWorld, terrainHeight } from './world.js';
import { spawnUnit, spawnBuilding, findEntityById } from './commands.js';
import { updateUnits, updateBuildings, updateFlags, updateEconomy, updateTimers, updateHealthBars } from './simulation.js';
import { updateProjectiles } from './combat.js';
import { initAI, updateAI } from './ai.js';
import {
  initUI, refreshCommandCard, tickCommandCard, tickMinimap, tickHUD,
  endGame, showOverlay, hideOverlay, exitPlacementMode, clickPlacement,
  screenToGround, enterPlacementMode, trainUnit
} from './ui.js';
import { spawnMoveMarker } from './effects.js';
import { feedEvent, showToast, hideToast } from './feed.js';
import { audio } from './audio.js';

const TILT = 0.66;

// ---------- Renderer / scene / camera ----------
const container = document.getElementById('scene-container');
const scene = new THREE.Scene();
G.scene = scene;
scene.background = new THREE.Color(0x9aa1a8);
scene.fog = new THREE.Fog(0x9aa1a8, 95, 235);

const camera = new THREE.PerspectiveCamera(46, container.clientWidth / container.clientHeight, 0.5, 700);
G.camera = camera;

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);
G.renderer = renderer;

// ---------- Lights (persistent) ----------
const hemi = new THREE.HemisphereLight(0xbcc8d4, 0x37342b, 0.78);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe6c0, 1.4);
sun.position.set(60, 90, 30);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -80;
sun.shadow.camera.right = 80;
sun.shadow.camera.top = 80;
sun.shadow.camera.bottom = -80;
sun.shadow.camera.near = 10;
sun.shadow.camera.far = 280;
sun.shadow.bias = -0.0009;
scene.add(sun);
scene.add(sun.target);

// ---------- Teardown between battles ----------
const persistent = new Set([hemi, sun, sun.target]);
function disposeTree(root) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const m = o.material;
    if (m) {
      const mats = Array.isArray(m) ? m : [m];
      for (const mm of mats) { if (mm.map) mm.map.dispose(); mm.dispose(); }
    }
  });
}
function teardownScene() {
  for (const child of [...scene.children]) {
    if (persistent.has(child)) continue;
    scene.remove(child);
    disposeTree(child);
  }
}

// ---------- Battlefield setup ----------
function setupBattlefield() {
  teardownScene();
  resetState();
  const built = buildWorld(scene);
  G.flags = built.flags;
  G.world = built;

  // HQs — one per side, instantly constructed
  const pHQ = spawnBuilding('player', 'hq', PLAYER_BASE.x, PLAYER_BASE.z, true);
  const aHQ = spawnBuilding('axis', 'hq', AXIS_BASE.x, AXIS_BASE.z, true);

  G.player = { req: ECONOMY.startReq, income: ECONOMY.baseIncome };
  G.axis = { req: ECONOMY.startReq * 0.9, income: ECONOMY.baseIncome };

  // Opening forces
  spawnUnit('player', 'rifle', PLAYER_BASE.x + 8, PLAYER_BASE.z - 5);
  spawnUnit('player', 'rifle', PLAYER_BASE.x + 11, PLAYER_BASE.z + 2);
  spawnUnit('player', 'recon', PLAYER_BASE.x + 4, PLAYER_BASE.z - 12);
  spawnUnit('axis', 'rifle', AXIS_BASE.x - 8, AXIS_BASE.z + 5);
  spawnUnit('axis', 'rifle', AXIS_BASE.x - 11, AXIS_BASE.z - 2);
  spawnUnit('axis', 'recon', AXIS_BASE.x - 4, AXIS_BASE.z + 12);

  initAI();
  clearSelectionRings();
  G.cam.target.set(PLAYER_BASE.x, terrainHeight(PLAYER_BASE.x, PLAYER_BASE.z), PLAYER_BASE.z);
  G.cam.azimuth = -Math.PI / 4;
  G.cam.dist = 64;
  G.time = 0;
  G.timeLeft = SKIRMISH_TIME;
  G.selectionDirty = true;
  return { pHQ, aHQ };
}

function startOperation() {
  setupBattlefield();
  G.mode = 'playing';
  hideOverlay('menu'); hideOverlay('pause'); hideOverlay('endscreen');
  document.getElementById('hud').classList.remove('hidden');
  refreshCommandCard();
  feedEvent('Operation Iron Front — destroy the Axis Headquarters', 'neutral');
  feedEvent('Capture flags A, B, C for +4 REQ/s each', 'neutral');
  audio.ensure(); audio.resume();
}
function quitToMenu() {
  setupBattlefield();
  G.mode = 'menu';
  document.getElementById('hud').classList.add('hidden');
  hideOverlay('pause'); hideOverlay('endscreen');
  showOverlay('menu');
}
function togglePause() {
  if (G.mode === 'playing') { G.mode = 'paused'; showOverlay('pause'); }
  else if (G.mode === 'paused') { G.mode = 'playing'; hideOverlay('pause'); hideToast(); }
}
window.__startOperation = startOperation;
window.__togglePause = togglePause;
window.__quitToMenu = quitToMenu;
window.__G = G; // debug handle

// ---------- Selection rings ----------
const ringGroup = new THREE.Group();
scene.add(ringGroup);
let selectionRings = [];
function clearSelectionRings() {
  for (const r of selectionRings) {
    ringGroup.remove(r);
    r.geometry.dispose();
    r.material.dispose();
  }
  selectionRings = [];
}
function rebuildSelectionRings() {
  clearSelectionRings();
  for (const e of G.selection) {
    const radius = e.isBuilding ? e.def.radius * 0.98 : e.def.radius + 0.6;
    const geo = new THREE.RingGeometry(radius - 0.28, radius, 40);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: e.side === 'player' ? 0x8be06a : 0xff6a4a,
      transparent: true, opacity: 0.95, depthWrite: false
    });
    const ring = new THREE.Mesh(geo, mat);
    ringGroup.add(ring);
    selectionRings.push(ring);
  }
}
function updateSelectionRings() {
  for (let i = 0; i < selectionRings.length; i++) {
    const e = G.selection[i];
    if (!e) continue;
    const p = e.group.position;
    selectionRings[i].position.set(p.x, terrainHeight(p.x, p.z) + 0.16, p.z);
  }
}
function setSelection(list) {
  G.selection = list;
  G.selectionDirty = true;
}

// ---------- Picking ----------
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function setRaycaster(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
}
function pickEntity(clientX, clientY) {
  setRaycaster(clientX, clientY);
  const groups = [];
  for (const u of G.units) if (!u.dead) groups.push(u.group);
  for (const b of G.buildings) if (!b.dead) groups.push(b.group);
  const hits = raycaster.intersectObjects(groups, true);
  if (!hits.length) return null;
  let obj = hits[0].object;
  while (obj && obj.userData.entityId === undefined) obj = obj.parent;
  if (!obj) return null;
  return findEntityById(obj.userData.entityId);
}

// ---------- Orders ----------
function selectedUnits() { return G.selection.filter(e => !e.isBuilding); }
function selectedProducers() { return G.selection.filter(e => e.isBuilding && e.type !== 'hq' && e.buildProgress >= 1); }

function issueMoveOrder(point, attackMove) {
  const units = selectedUnits();
  if (!units.length) return;
  for (const u of units) {
    u.order = { kind: attackMove ? 'attackmove' : 'move', x: point.x, z: point.z };
    u.anchor = { x: point.x, z: point.z };
    u.target = null;
  }
  spawnMoveMarker(point, attackMove ? 0xffb07a : 0x8be06a);
  audio.uiClick();
}
function issueAttackOrder(target) {
  const units = selectedUnits();
  if (!units.length) return;
  for (const u of units) {
    u.order = { kind: 'attack', target, x: target.group.position.x, z: target.group.position.z };
    u.anchor = { x: target.group.position.x, z: target.group.position.z };
  }
  audio.uiClick();
}
function stopSelection() {
  const units = selectedUnits();
  for (const u of units) {
    u.order = { kind: 'idle', x: u.group.position.x, z: u.group.position.z };
    u.anchor = { x: u.group.position.x, z: u.group.position.z };
    u.target = null;
  }
  if (units.length) audio.uiClick();
}
function toggleHold() {
  const units = selectedUnits();
  for (const u of units) u.stance = u.stance === 'hold' ? 'fire' : 'hold';
  if (units.length) { audio.uiClick(); G.selectionDirty = true; refreshCommandCard(); }
}
function setRallyPoint(point) {
  const producers = selectedProducers();
  for (const b of producers) b.rally = { x: point.x, z: point.z };
  if (producers.length) {
    spawnMoveMarker(point, 0xd6b25e);
    audio.uiClick();
  }
}

// ---------- Input: mouse / touch / keyboard ----------
const canvas = renderer.domElement;
canvas.addEventListener('mouseenter', () => { pointerState.overCanvas = true; });
canvas.addEventListener('mouseleave', () => { pointerState.overCanvas = false; });
const selectionBoxEl = document.getElementById('selection-box');
const pointerState = {
  down: false, downX: 0, downY: 0, dragging: false, pointerId: null, pointerType: 'mouse',
  lastX: null, lastY: null, overCanvas: true, moveType: 'mouse'
};
const activePointers = new Map();
let pinchStart = null;

canvas.addEventListener('pointerdown', (e) => {
  if (G.mode !== 'playing') return;
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (activePointers.size === 2) {
    const pts = [...activePointers.values()];
    pinchStart = { dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), mid: { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 } };
    pointerState.down = false;
    selectionBoxEl.classList.add('hidden');
    return;
  }
  if (e.pointerType === 'mouse' && e.button === 2) return; // handled by contextmenu
  pointerState.down = true;
  pointerState.downX = e.clientX;
  pointerState.downY = e.clientY;
  pointerState.dragging = false;
  pointerState.pointerId = e.pointerId;
  pointerState.pointerType = e.pointerType;
  try { canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId); } catch (_) { /* synthetic or stale pointer */ }
});

window.addEventListener('pointermove', (e) => {
  pointerState.lastX = e.clientX;
  pointerState.lastY = e.clientY;
  pointerState.moveType = e.pointerType || 'mouse';
  if (activePointers.has(e.pointerId)) activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (G.mode !== 'playing') return;

  // Pinch zoom + two-finger pan
  if (activePointers.size === 2 && pinchStart) {
    const pts = [...activePointers.values()];
    const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
    if (pinchStart.dist > 0) {
      G.cam.dist = clampNum(G.cam.dist * (pinchStart.dist / Math.max(20, dist)), G.cam.minDist, G.cam.maxDist);
    }
    panCameraByPixels(mid.x - pinchStart.mid.x, mid.y - pinchStart.mid.y);
    pinchStart = { dist, mid };
    return;
  }

  if (!pointerState.down || e.pointerId !== pointerState.pointerId) return;
  const dx = e.clientX - pointerState.downX, dy = e.clientY - pointerState.downY;
  if (!pointerState.dragging && Math.hypot(dx, dy) > 7) pointerState.dragging = true;
  if (pointerState.dragging) {
    const x = Math.min(pointerState.downX, e.clientX), y = Math.min(pointerState.downY, e.clientY);
    selectionBoxEl.classList.remove('hidden');
    selectionBoxEl.style.left = x + 'px';
    selectionBoxEl.style.top = y + 'px';
    selectionBoxEl.style.width = Math.abs(dx) + 'px';
    selectionBoxEl.style.height = Math.abs(dy) + 'px';
  }
});

window.addEventListener('pointerup', (e) => {
  activePointers.delete(e.pointerId);
  if (activePointers.size < 2) pinchStart = null;
  if (G.mode !== 'playing') { pointerState.down = false; return; }
  if (e.pointerId !== pointerState.pointerId || !pointerState.down) { pointerState.down = false; return; }
  pointerState.down = false;
  const wasDragging = pointerState.dragging;
  pointerState.dragging = false;
  selectionBoxEl.classList.add('hidden');

  if (G.placingBuilding) { clickPlacement(e.clientX, e.clientY); return; }

  const pt = screenToGround(e.clientX, e.clientY);
  if (G.attackMoveMode) {
    G.attackMoveMode = false;
    if (pt) issueMoveOrder(pt, true);
    return;
  }

  if (wasDragging) {
    boxSelect(pointerState.downX, pointerState.downY, e.clientX, e.clientY, e.shiftKey);
    return;
  }
  // --- Click selection
  const hit = pickEntity(e.clientX, e.clientY);
  const isTouch = pointerState.pointerType === 'touch';
  if (hit) {
    if (hit.side === 'player') {
      if (isTouch) {
        const mineOnly = G.selection.length === 1 && G.selection[0] === hit;
        setSelection(mineOnly ? [] : [hit]);
      } else if (e.shiftKey) {
        if (!G.selection.includes(hit)) setSelection([...G.selection, hit]);
      } else setSelection([hit]);
      audio.uiClick();
    } else {
      // Enemy tapped/clicked
      if (isTouch && selectedUnits().length) issueAttackOrder(hit);
    }
  } else {
    if (pt && isTouch && selectedUnits().length) {
      issueMoveOrder(pt, false);
    } else if (!e.shiftKey && !isTouch) {
      setSelection([]);
    } else if (isTouch && !selectedUnits().length) {
      setSelection([]);
    }
  }
});

canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if (G.mode !== 'playing') return;
  if (G.placingBuilding) { exitPlacementMode(); return; }
  const hit = pickEntity(e.clientX, e.clientY);
  if (hit && hit.side === 'axis') { issueAttackOrder(hit); return; }
  const pt = screenToGround(e.clientX, e.clientY);
  if (!pt) return;
  if (selectedProducers().length && !selectedUnits().length) setRallyPoint(pt);
  else issueMoveOrder(pt, false);
});

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  if (G.mode !== 'playing' && G.mode !== 'paused') return;
  G.cam.dist = clampNum(G.cam.dist * (1 + e.deltaY * 0.0011), G.cam.minDist, G.cam.maxDist);
}, { passive: false });

canvas.addEventListener('dblclick', (e) => {
  if (G.mode !== 'playing') return;
  const hit = pickEntity(e.clientX, e.clientY);
  if (hit && !hit.isBuilding && hit.side === 'player') {
    setSelection(G.units.filter(u => u.type === hit.type && u.side === 'player' && !u.dead));
    audio.uiClick();
  }
});

function boxSelect(x0, y0, x1, y1, additive) {
  const minX = Math.min(x0, x1), maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1), maxY = Math.max(y0, y1);
  const rect = renderer.domElement.getBoundingClientRect();
  const inBox = [];
  const v = new THREE.Vector3();
  for (const u of G.units) {
    if (u.side !== 'player' || u.dead) continue;
    v.copy(u.group.position); v.y += 1;
    v.project(camera);
    const sx = (v.x * 0.5 + 0.5) * rect.width + rect.left;
    const sy = (-v.y * 0.5 + 0.5) * rect.height + rect.top;
    if (sx >= minX && sx <= maxX && sy >= minY && sy <= maxY) inBox.push(u);
  }
  if (additive) {
    const merged = [...G.selection];
    for (const u of inBox) if (!merged.includes(u)) merged.push(u);
    setSelection(merged);
  } else setSelection(inBox);
  if (inBox.length) audio.uiClick();
}

function panCameraByPixels(dx, dy) {
  const k = G.cam.dist * 0.0016;
  const az = G.cam.azimuth;
  const right = { x: Math.cos(az), z: -Math.sin(az) };
  const fwd = { x: -Math.sin(az), z: -Math.cos(az) };
  G.cam.target.x += (-dx * right.x + dy * fwd.x) * k;
  G.cam.target.z += (-dx * right.z + dy * fwd.z) * k;
  clampCamTarget();
}
function clampCamTarget() {
  G.cam.target.x = clampNum(G.cam.target.x, -MAP_SIZE / 2 + 8, MAP_SIZE / 2 - 8);
  G.cam.target.z = clampNum(G.cam.target.z, -MAP_SIZE / 2 + 8, MAP_SIZE / 2 - 8);
  G.cam.target.y = terrainHeight(G.cam.target.x, G.cam.target.z);
}
const clampNum = (v, a, b) => (v < a ? a : v > b ? b : v);

const keysDown = new Set();
window.addEventListener('keydown', (e) => {
  const code = e.code;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) e.preventDefault();
  keysDown.add(code);
  if (code === 'Escape') {
    if (G.placingBuilding) { exitPlacementMode(); return; }
    if (G.attackMoveMode) { G.attackMoveMode = false; return; }
    if (G.mode === 'playing' || G.mode === 'paused') togglePause();
    return;
  }
  if (code === 'Space') { if (G.mode === 'playing' || G.mode === 'paused') togglePause(); return; }
  if (G.mode !== 'playing') return;
  const hqSelected = G.selection.length === 1 && G.selection[0].isBuilding && G.selection[0].type === 'hq';
  const singleProducer = G.selection.length === 1 && G.selection[0].isBuilding && G.selection[0].type !== 'hq' && G.selection[0].buildProgress >= 1
    ? G.selection[0] : null;
  switch (code) {
    case 'KeyA': case 'KeyM':
      if (selectedUnits().length) { G.attackMoveMode = true; showToast('Attack-move — click a destination'); }
      break;
    case 'KeyS': stopSelection(); break;
    case 'KeyH': toggleHold(); break;
    case 'KeyB': if (hqSelected) enterPlacementMode('barracks'); break;
    case 'KeyF': if (hqSelected) enterPlacementMode('factory'); break;
    case 'KeyQ':
      if (singleProducer && singleProducer.type === 'barracks') trainFrom(singleProducer, 'rifle');
      else if (singleProducer && singleProducer.type === 'factory') trainFrom(singleProducer, 'tank');
      break;
    case 'KeyW':
      if (singleProducer && singleProducer.type === 'barracks') trainFrom(singleProducer, 'recon');
      else if (singleProducer && singleProducer.type === 'factory') trainFrom(singleProducer, 'arty');
      break;
  }
});
window.addEventListener('keyup', (e) => keysDown.delete(e.code));
window.addEventListener('blur', () => keysDown.clear());
document.addEventListener('visibilitychange', () => {
  if (document.hidden && G.mode === 'playing') togglePause();
});

function trainFrom(building, type) { trainUnit(building, type); }

// ---------- Camera update ----------
function updateCamera(dt) {
  if (G.mode === 'menu') {
    const t = G.clockTime;
    const a = t * 0.055;
    camera.position.set(Math.sin(a) * 96, 47 + Math.sin(t * 0.24) * 5, Math.cos(a) * 96);
    camera.lookAt(0, 2, 0);
    return;
  }
  const az = G.cam.azimuth;
  const panSpeed = 52 * (G.cam.dist / 64);
  const fwdX = -Math.sin(az), fwdZ = -Math.cos(az);
  const rightX = Math.cos(az), rightZ = -Math.sin(az);
  let mx = 0, mz = 0;
  // Arrow keys pan (WASD reserved for orders: A attack-move, S stop)
  if (keysDown.has('ArrowUp')) { mx += fwdX; mz += fwdZ; }
  if (keysDown.has('ArrowDown')) { mx -= fwdX; mz -= fwdZ; }
  if (keysDown.has('ArrowRight')) { mx += rightX; mz += rightZ; }
  if (keysDown.has('ArrowLeft')) { mx -= rightX; mz -= rightZ; }
  // Edge pan (mouse only, pointer over canvas, mouse known position)
  const edge = 16;
  if (pointerState.lastX !== null && pointerState.moveType === 'mouse' && pointerState.overCanvas !== false) {
    const mxE = pointerState.lastX, myE = pointerState.lastY;
    if (mxE < edge) { mx -= rightX; mz -= rightZ; }
    else if (mxE > window.innerWidth - edge) { mx += rightX; mz += rightZ; }
    if (myE < edge) { mx += fwdX; mz += fwdZ; }
    else if (myE > window.innerHeight - edge) { mx -= fwdX; mz -= fwdZ; }
  }
  const len = Math.hypot(mx, mz);
  if (len > 0.001) {
    G.cam.target.x += (mx / len) * panSpeed * dt;
    G.cam.target.z += (mz / len) * panSpeed * dt;
  }
  // Rotate with Q / E (A reserved for attack-move)
  if (keysDown.has('KeyQ')) G.cam.azimuth += 1.7 * dt;
  if (keysDown.has('KeyE')) G.cam.azimuth -= 1.7 * dt;
  clampCamTarget();

  const horiz = G.cam.dist * Math.cos(TILT);
  const y = G.cam.dist * Math.sin(TILT);
  camera.position.set(
    G.cam.target.x + Math.sin(az) * horiz,
    G.cam.target.y + y,
    G.cam.target.z + Math.cos(az) * horiz
  );
  // Screen shake
  if (G.shake > 0.01) {
    camera.position.x += (Math.random() - 0.5) * G.shake * 2.2;
    camera.position.y += (Math.random() - 0.5) * G.shake * 1.6;
    camera.position.z += (Math.random() - 0.5) * G.shake * 2.2;
    G.shake = Math.max(0, G.shake - dt * 1.9);
  }
  camera.lookAt(G.cam.target);
}

// ---------- End conditions ----------
let endCheckT = 0;
function checkEndConditions(dt) {
  endCheckT -= dt;
  if (endCheckT > 0) return;
  endCheckT = 0.5;
  const playerHQ = G.buildings.find(b => b.side === 'player' && b.type === 'hq');
  const axisHQ = G.buildings.find(b => b.side === 'axis' && b.type === 'hq');
  if (!axisHQ) return endGame('player', 'Axis headquarters destroyed — the Ardennes salient collapses.');
  if (!playerHQ) return endGame('axis', 'Your headquarters was destroyed — the line breaks.');
  if (G.timeLeft <= 0) {
    const pFrac = playerHQ.hp / playerHQ.maxHp, aFrac = axisHQ.hp / axisHQ.maxHp;
    if (pFrac >= aFrac) endGame('player', 'The assault stalls — your headquarters held the stronger line.');
    else endGame('axis', 'The offensive peters out — the enemy holds the stronger line.');
  }
}

// ---------- Main loop ----------
const clock = new THREE.Clock();
let cmdCardT = 0;

function animate() {
  requestAnimationFrame(animate);
  const realDt = Math.min(0.05, clock.getDelta());
  G.clockTime += realDt;
  const dt = realDt * (G.mode === 'playing' ? G.timeScale : 0);

  if (G.mode === 'playing') {
    G.time += dt;
    updateUnits(dt);
    updateBuildings(dt);
    updateFlags(dt);
    updateEconomy(dt);
    updateTimers(dt);
    updateProjectiles(dt);
    updateAI(dt);
    checkEndConditions(realDt);
  }

  // Effects & bars animate in menu/pause too (frozen when paused? keep paused static)
  if (G.mode !== 'paused') {
    for (let i = G.effects.length - 1; i >= 0; i--) {
      if (!G.effects[i].update(G.mode === 'playing' ? dt : realDt * 0.6)) G.effects.splice(i, 1);
    }
    // Drifting clouds
    if (G.world && G.world.clouds) {
      for (const c of G.world.clouds) {
        c.position.x += c.userData.drift * realDt;
        if (c.position.x > 230) c.position.x = -230;
      }
    }
  }

  updateCamera(realDt);

  // Sun shadow follows camera target
  sun.position.set(G.cam.target.x + 62, G.cam.target.y + 95, G.cam.target.z + 34);
  sun.target.position.copy(G.cam.target);
  sun.target.updateMatrixWorld();

  if (G.mode === 'playing' || G.mode === 'paused') {
    updateHealthBars();
    updateSelectionRings();
    tickMinimap(realDt);
    tickHUD(realDt);
    cmdCardT -= realDt;
    if (cmdCardT <= 0) { cmdCardT = 0.3; tickCommandCard(); }
    if (G.selectionDirty) {
      G.selectionDirty = false;
      rebuildSelectionRings();
      refreshCommandCard();
    }
  }

  renderer.render(scene, camera);
}
// ---------- Resize ----------
window.addEventListener('resize', () => {
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
});

// ---------- Boot ----------
initUI();
setupBattlefield();   // menu backdrop
G.mode = 'menu';
animate();
