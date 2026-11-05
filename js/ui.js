// HUD: menus, command card, selection panel, minimap, overlays.
import { G } from './state.js';
import { DIFFICULTY, BUILDING_DEFS, UNIT_DEFS, FACTIONS, ECONOMY } from './config.js';
import { feedEvent, showToast, hideToast } from './feed.js';
import { renderMinimapBase, terrainHeight } from './world.js';
import { audio } from './audio.js';
import { spawnBuilding } from './commands.js';
import { makeBuildingMesh } from './entities.js';
import { spawnMoveMarker } from './effects.js';
import * as THREE from 'three';

const $ = (id) => document.getElementById(id);

// ---------- Inline SVG icon set (no assets) ----------
const svgWrap = (inner) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
export const ICONS = {
  rifle: svgWrap('<path d="M4 14a8 6 0 0 1 16 0z"/><path d="M2 14h20"/><path d="M7 17h10"/><path d="M12 14v-3"/>'),
  recon: svgWrap('<path d="M3 14l2-5h9l4 3h3v4H3z"/><circle cx="7.5" cy="17" r="1.6"/><circle cx="16.5" cy="17" r="1.6"/><path d="M11 9V7h3"/>'),
  tank: svgWrap('<rect x="2" y="11" width="20" height="5" rx="1.5"/><rect x="7" y="8" width="9" height="4" rx="1"/><path d="M16 10h6"/><path d="M4 19h16"/>'),
  arty: svgWrap('<circle cx="7" cy="17" r="2.4"/><circle cx="17" cy="17" r="2.4"/><path d="M7 17l6-8 7-4"/><path d="M9.5 12.5 12 15"/>'),
  barracks: svgWrap('<path d="M3 20V10l9-6 9 6v10"/><path d="M3 20h18"/><path d="M10 20v-5h4v5"/><path d="M12 4v3"/>'),
  factory: svgWrap('<path d="M3 21V11l6 4v-4l6 4V9h6v12z"/><path d="M3 21h18"/><path d="M17 9V5h2.5v4"/>'),
  hq: svgWrap('<path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L4.2 9.4l6.1-.8z"/>'),
  attackmove: svgWrap('<circle cx="12" cy="12" r="6.5"/><path d="M12 2v6M12 16v6M2 12h6M16 12h6"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/>'),
  stop: svgWrap('<rect x="6" y="6" width="12" height="12" rx="1.5"/>'),
  hold: svgWrap('<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/>'),
  star: svgWrap('<path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L4.2 9.4l6.1-.8z"/>')
};

// ---------- Event wiring ----------
export function initUI() {
  $('start-btn').addEventListener('click', () => {
    audio.ensure(); audio.resume(); audio.uiClick();
    window.__startOperation && window.__startOperation();
  });
  document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      audio.ensure(); audio.uiClick();
      document.querySelectorAll('.diff-btn').forEach(b => b.classList.toggle('selected', b === btn));
      G.difficulty = btn.dataset.diff;
    });
  });
  $('howto-btn').addEventListener('click', () => { audio.uiClick(); $('howto-panel').classList.toggle('open'); });
  $('pause-btn').addEventListener('click', () => { audio.uiClick(); window.__togglePause && window.__togglePause(); });
  $('mute-btn').addEventListener('click', () => { toggleMute(); });
  $('menu-mute').addEventListener('click', () => { toggleMute(); });
  $('speed-toggle').addEventListener('click', () => { G.timeScale = G.timeScale === 1 ? 2 : 1; $('speed-toggle').textContent = G.timeScale === 1 ? '×1' : '×2'; audio.uiClick(); });
  $('resume-btn').addEventListener('click', () => { audio.uiClick(); window.__togglePause && window.__togglePause(); });
  $('restart-btn').addEventListener('click', () => { audio.uiClick(); window.__startOperation && window.__startOperation(); });
  $('quit-btn').addEventListener('click', () => { audio.uiClick(); window.__quitToMenu && window.__quitToMenu(); });
  $('again-btn').addEventListener('click', () => { audio.uiClick(); window.__startOperation && window.__startOperation(); });
  $('endmenu-btn').addEventListener('click', () => { audio.uiClick(); window.__quitToMenu && window.__quitToMenu(); });

  // Tap the placement hint bar to cancel (touch-friendly)
  $('placement-hint').addEventListener('click', () => { exitPlacementMode(); });

  // Minimap navigation
  const mm = $('minimap');
  const jump = (e) => {
    const rect = mm.getBoundingClientRect();
    const cx = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const cy = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    const wx = (cx / rect.width - 0.5) * 240;
    const wz = (cy / rect.height - 0.5) * 240;
    G.cam.target.set(wx, terrainHeight(wx, wz), wz);
  };
  mm.addEventListener('mousedown', jump);
  mm.addEventListener('touchstart', jump, { passive: true });

  // Click-to-place ghost buildings
  const canvas = G.renderer.domElement;
  canvas.addEventListener('mousemove', updateGhost);
  canvas.addEventListener('mouseleave', () => hideGhost());
}

function toggleMute() {
  G.muted = !G.muted;
  audio.ensure();
  audio.setMuted(G.muted);
  document.querySelectorAll('.mute-label').forEach(el => { el.textContent = G.muted ? 'Sound: Off' : 'Sound: On'; });
  $('mute-btn').classList.toggle('muted', G.muted);
}

// ---------- Ghost preview while placing a building ----------
let ghost = null, ghostValid = false, ghostRing = null;
export function enterPlacementMode(kind) {
  G.placingBuilding = kind;
  $('placement-hint').textContent = `Placing ${BUILDING_DEFS[kind].name} — tap the map to build · tap here / right-click / Esc to cancel`;
  $('placement-hint').classList.remove('hidden');
  ensureGhost();
}
export function exitPlacementMode() {
  G.placingBuilding = null;
  $('placement-hint').classList.add('hidden');
  if (ghost) { G.scene.remove(ghost); ghost.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); }); ghost = null; }
  if (ghostRing) { G.scene.remove(ghostRing); ghostRing.geometry.dispose(); ghostRing.material.dispose(); ghostRing = null; }
}

function ensureGhost() {
  if (ghost) return;
  ghost = makeBuildingMesh('player', G.placingBuilding);
  ghost.traverse(o => {
    if (!o.isMesh) return;
    o.material = o.material.clone();
    o.material.transparent = true;
    o.material.opacity = 0.5;
    o.material.depthWrite = false;
    o.castShadow = false;
  });
  const ringGeo = new THREE.RingGeometry(BUILDING_DEFS[G.placingBuilding].radius + 0.4, BUILDING_DEFS[G.placingBuilding].radius + 1.1, 36);
  ringGeo.rotateX(-Math.PI / 2);
  ghostRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0x8be06a, transparent: true, opacity: 0.85, depthWrite: false }));
  G.scene.add(ghost);
  G.scene.add(ghostRing);
}
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
if (typeof window !== 'undefined') window.__debugPlacement = {};
export function screenToGround(clientX, clientY) {
  const rect = G.renderer.domElement.getBoundingClientRect();
  ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(ndc, G.camera);
  const hit = new THREE.Vector3();
  // Intersect with mathematical plane at y = terrainHeight approx — use 0-plane then refine
  if (!raycaster.ray.intersectPlane(groundPlane, hit)) return null;
  hit.y = terrainHeight(hit.x, hit.z);
  const out = hit;
  window.__debugPlacement.lastGround = { x: hit.x, y: hit.y, z: hit.z };
  return out;
}
function updateGhost(e) {
  if (!G.placingBuilding) return;
  ensureGhost();
  const pt = screenToGround(e.clientX, e.clientY);
  if (!pt) { hideGhost(); return; }
  ghost.visible = true; ghostRing.visible = true;
  ghost.position.set(pt.x, pt.y, pt.z);
  ghostRing.position.set(pt.x, pt.y + 0.25, pt.z);
  ghostValid = placementValid(pt.x, pt.z, G.placingBuilding);
  ghostRing.material.color.setHex(ghostValid ? 0x8be06a : 0xe0604a);
}
function hideGhost() { if (ghost) ghost.visible = false; if (ghostRing) ghostRing.visible = false; }
export function placementValid(x, z, kind) {
  const r = BUILDING_DEFS[kind].radius;
  const B = 120 - r - 2;
  if (Math.abs(x) > B || Math.abs(z) > B) return false;
  for (const b of G.buildings) {
    if (Math.hypot(b.group.position.x - x, b.group.position.z - z) < b.def.radius + r + 1.2) return false;
  }
  for (const f of G.flags) {
    if (Math.hypot(f.x - x, f.z - z) < 11) return false;
  }
  return true;
}
window.__debugPlacement.placementValid = placementValid;
export function clickPlacement(clientX, clientY) {
  const pt = screenToGround(clientX, clientY);
  if (!pt) return;
  const kind = G.placingBuilding;
  if (!placementValid(pt.x, pt.z, kind)) { showToast('Invalid construction site'); audio.alarm(); return; }
  const cost = BUILDING_DEFS[kind].cost;
  if (G.player.req < cost) { showToast('Insufficient requisition'); audio.alarm(); return; }
  G.player.req -= cost;
  spawnBuilding('player', kind, pt.x, pt.z, false);
  feedEvent(`${BUILDING_DEFS[kind].name} under construction`, 'player');
  audio.build();
  exitPlacementMode();
}

// ---------- Production ----------
export function trainUnit(building, type) {
  const def = UNIT_DEFS[type];
  if (G.player.req < def.cost) { showToast('Insufficient requisition'); audio.alarm(); return; }
  if (building.queue.length >= 5) { showToast('Production queue full'); return; }
  const count = G.units.filter(u => u.side === 'player').length + queuedCount('player');
  if (count >= ECONOMY.unitCap) { showToast('Unit cap reached — capture flags / build more'); return; }
  G.player.req -= def.cost;
  building.queue.push({ type, t: def.buildTime, total: def.buildTime });
  audio.build();
  refreshCommandCard();
}
function queuedCount(side) {
  let n = 0;
  for (const b of G.buildings) if (b.side === side) for (const q of b.queue) n++;
  return n;
}

// ---------- Selection info + command card ----------
function selectedProducer() {
  const s = G.selection;
  if (s.length === 1 && s[0].isBuilding) return s[0];
  return null;
}
function unitCountHeader() {
  const counts = {};
  for (const e of G.selection) if (!e.isBuilding) counts[e.type] = (counts[e.type] || 0) + 1;
  return Object.entries(counts).map(([t, n]) => `${UNIT_DEFS[t] ? factName(t) : t} ×${n}`).join('  ·  ');
}
function factName(t) { return FACTIONS.player.units[t] || t; }

export function refreshCommandCard() {
  const card = $('command-card');
  const info = $('selection-panel');
  const btnWrap = $('cc-buttons');
  btnWrap.innerHTML = '';

  const sel = G.selection;
  if (!sel.length) {
    $('cc-title').textContent = 'FIELD COMMAND';
    $('sel-name').textContent = 'No selection';
    $('sel-sub').textContent = 'Drag a box or click a unit';
    $('sel-hp-fill').style.width = '0%';
    $('sel-portrait').innerHTML = ICONS.hq;
    $('sel-portrait').classList.add('empty');
    btnWrap.innerHTML = '<div class="cc-hint">Select a unit or building.<br><span>Right-click: move / attack / capture · A: attack-move · S: stop · H: hold</span></div>';
    return;
  }

  // Selection summary
  const anyBld = sel.find(e => e.isBuilding);
  if (sel.length === 1) {
    const e = sel[0];
    $('sel-name').textContent = e.isBuilding ? BUILDING_DEFS[e.type].name : FACTIONS.player.units[e.type];
    $('sel-hp-fill').style.width = `${Math.max(0, (e.hp / e.maxHp) * 100)}%`;
    if (e.isBuilding) {
      $('sel-portrait').innerHTML = e.type === 'hq' ? ICONS.hq : e.type === 'barracks' ? ICONS.barracks : ICONS.factory;
      $('cc-title').textContent = e.type === 'hq' ? 'HEADQUARTERS' : e.type === 'barracks' ? 'BARRACKS — TRAINING' : 'WAR FACTORY — PRODUCTION';
      const under = e.buildProgress < 1 ? `Under construction — ${Math.floor(e.buildProgress * 100)}%` : `${Math.ceil(e.hp)} / ${e.maxHp} HP`;
      const rally = e.buildProgress >= 1 && e.type !== 'hq' ? ' · Right-click ground: set rally' : '';
      $('sel-sub').textContent = under + rally;
    } else {
      $('sel-portrait').innerHTML = ICONS[e.type];
      $('cc-title').textContent = 'UNIT COMMAND';
      $('sel-sub').textContent = `${Math.ceil(e.hp)} / ${e.maxHp} HP · ${e.kills || 0} kills · ${e.stance === 'hold' ? 'Holding' : 'Free fire'}`;
    }
    $('sel-portrait').classList.remove('empty');
  } else {
    $('sel-portrait').innerHTML = ICONS.tank;
    $('sel-portrait').classList.remove('empty');
    $('sel-name').textContent = `${sel.length} units selected`;
    $('sel-sub').textContent = unitCountHeader();
    const totHp = sel.reduce((a, e) => a + e.hp / e.maxHp, 0) / sel.length;
    $('sel-hp-fill').style.width = `${totHp * 100}%`;
    $('cc-title').textContent = 'GROUP COMMAND';
  }

  const producer = selectedProducer();
  if (producer && producer.buildProgress >= 1) {
    if (producer.type === 'hq') {
      addButton(btnWrap, { icon: ICONS.barracks, label: 'Barracks', cost: BUILDING_DEFS.barracks.cost, hotkey: 'B', onClick: () => enterPlacementMode('barracks') });
      addButton(btnWrap, { icon: ICONS.factory, label: 'War Factory', cost: BUILDING_DEFS.factory.cost, hotkey: 'F', onClick: () => enterPlacementMode('factory') });
    } else if (producer.type === 'barracks') {
      addButton(btnWrap, { icon: ICONS.rifle, label: FACTIONS.player.units.rifle, cost: UNIT_DEFS.rifle.cost, hotkey: 'Q', onClick: () => trainUnit(producer, 'rifle') });
      addButton(btnWrap, { icon: ICONS.recon, label: FACTIONS.player.units.recon, cost: UNIT_DEFS.recon.cost, hotkey: 'W', onClick: () => trainUnit(producer, 'recon') });
      renderQueue(btnWrap, producer);
    } else if (producer.type === 'factory') {
      addButton(btnWrap, { icon: ICONS.tank, label: FACTIONS.player.units.tank, cost: UNIT_DEFS.tank.cost, hotkey: 'Q', onClick: () => trainUnit(producer, 'tank') });
      addButton(btnWrap, { icon: ICONS.arty, label: FACTIONS.player.units.arty, cost: UNIT_DEFS.arty.cost, hotkey: 'W', onClick: () => trainUnit(producer, 'arty') });
      renderQueue(btnWrap, producer);
    }
  } else if (!producer) {
    const hasUnits = sel.some(e => !e.isBuilding);
    if (hasUnits) {
      addButton(btnWrap, { icon: ICONS.attackmove, label: 'Attack-Move', hotkey: 'A', onClick: () => { G.attackMoveMode = true; showToast('Attack-move: click a destination'); } });
      addButton(btnWrap, { icon: ICONS.stop, label: 'Stop', hotkey: 'S', onClick: () => { for (const e of sel) if (!e.isBuilding) { e.order = { kind: 'idle', x: e.group.position.x, z: e.group.position.z }; e.anchor = { x: e.group.position.x, z: e.group.position.z }; e.target = null; } audio.uiClick(); } });
      addButton(btnWrap, { icon: ICONS.hold, label: 'Hold Position', hotkey: 'H', onClick: () => { for (const e of sel) if (!e.isBuilding) e.stance = e.stance === 'hold' ? 'fire' : 'hold'; audio.uiClick(); refreshCommandCard(); } });
    }
  }
}

function addButton(wrap, { icon, label, cost, hotkey, onClick }) {
  const b = document.createElement('button');
  b.className = 'cc-btn';
  const afford = cost === undefined || G.player.req >= cost;
  if (!afford) b.classList.add('disabled');
  b.innerHTML = `<span class="cc-icon">${icon}</span><span class="cc-label">${label}</span>${cost !== undefined ? `<span class="cc-cost">${cost} <em>REQ</em></span>` : ''}${hotkey ? `<span class="cc-hotkey">${hotkey}</span>` : ''}`;
  b.title = label + (cost !== undefined ? ` — ${cost} requisition` : '');
  b.addEventListener('click', () => {
    if (!afford) { showToast('Insufficient requisition'); audio.alarm(); return; }
    audio.uiClick();
    onClick();
  });
  wrap.appendChild(b);
}

function renderQueue(wrap, building) {
  if (!building.queue.length) return;
  const q = document.createElement('div');
  q.className = 'cc-queue';
  const items = building.queue.slice(0, 5).map((item, i) => {
    const pct = i === 0 ? Math.max(0, Math.min(100, (1 - item.t / item.total) * 100)) : 0;
    return `<div class="queue-slot ${i === 0 ? 'active' : ''}">${ICONS[item.type]}<div class="queue-bar"><div style="width:${pct}%"></div></div></div>`;
  }).join('');
  q.innerHTML = items;
  wrap.appendChild(q);
}

// Queue progress needs periodic refresh even without clicks
export function tickCommandCard() {
  const producer = selectedProducer();
  if (producer) refreshCommandCard();
}

// ---------- Minimap ----------
let minimapBase = null;
let minimapTimer = 0;
export function tickMinimap(dt) {
  minimapTimer -= dt;
  if (minimapTimer > 0) return;
  minimapTimer = 0.22;
  const mm = $('minimap');
  const ctx = mm.getContext('2d');
  if (!minimapBase) minimapBase = renderMinimapBase();
  const S = mm.width;
  ctx.clearRect(0, 0, S, S);
  ctx.drawImage(minimapBase, 0, 0, S, S);
  const toPx = (x, z) => [ (x / 240 + 0.5) * S, (z / 240 + 0.5) * S ];
  // Base territory tint
  // Flags
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const f of G.flags) {
    const [x, y] = toPx(f.x, f.z);
    ctx.beginPath();
    ctx.arc(x, y, 6.2, 0, Math.PI * 2);
    ctx.fillStyle = f.owner === 'player' ? '#8be06a' : f.owner === 'axis' ? '#ff6a4a' : '#d8d5c8';
    ctx.fill();
    ctx.strokeStyle = '#101008'; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.fillStyle = '#141410'; ctx.font = 'bold 7px Arial'; ctx.fillText(f.id, x, y + 0.5);
  }
  // Buildings
  for (const b of G.buildings) {
    const [x, y] = toPx(b.group.position.x, b.group.position.z);
    ctx.fillStyle = b.side === 'player' ? (b.type === 'hq' ? '#b6f29a' : '#6fae58') : (b.type === 'hq' ? '#ff9a7a' : '#c05a40');
    const s = b.type === 'hq' ? 7 : 5;
    ctx.fillRect(x - s / 2, y - s / 2, s, s);
    ctx.strokeStyle = '#0d0d08'; ctx.lineWidth = 1; ctx.strokeRect(x - s / 2, y - s / 2, s, s);
  }
  // Units
  for (const u of G.units) {
    const [x, y] = toPx(u.group.position.x, u.group.position.z);
    ctx.fillStyle = u.side === 'player' ? '#d2f0b0' : '#ffb0a0';
    ctx.fillRect(x - 1.2, y - 1.2, 2.4, 2.4);
  }
  // Camera frustum (approximate)
  const cam = G.cam;
  const [cx, cy] = toPx(cam.target.x, cam.target.z);
  const halfW = (cam.dist * 0.62 / 240) * S;
  const halfH = (cam.dist * 0.40 / 240) * S;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-cam.azimuth + Math.PI);
  ctx.strokeStyle = 'rgba(255,233,160,0.9)'; ctx.lineWidth = 1.4;
  ctx.strokeRect(-halfW, -halfH, halfW * 2, halfH * 2);
  ctx.restore();
}

// ---------- Top bar / pips / timer ----------
export function tickHUD(dt) {
  // Toast fade
  if (G.toast) {
    G.toast.t -= dt;
    if (G.toast.t <= 0) hideToast();
  }
  $('req-count').textContent = Math.floor(G.player.req);
  $('req-income').textContent = `+${G.player.income.toFixed(1)}/s`;
  // Flag pips
  for (const f of G.flags) {
    const pip = $('pip-' + f.id);
    if (pip) pip.className = 'pip pip-' + f.owner + (f.contested ? ' pip-contested' : '');
  }
  // Timer counts down only while the battle runs
  if (G.mode === 'playing') G.timeLeft = Math.max(0, G.timeLeft - dt);
  const t = Math.floor(G.timeLeft);
  $('game-timer').textContent = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

// ---------- Overlays ----------
export function showOverlay(id) { $(id).classList.remove('hidden'); }
export function hideOverlay(id) { $(id).classList.add('hidden'); }

export function endGame(winner, reason) {
  G.mode = 'over';
  const s = G.stats;
  $('end-title').textContent = winner === 'player' ? 'VICTORY' : 'DEFEAT';
  $('end-title').className = winner === 'player' ? 'end-title victory' : 'end-title defeat';
  $('end-sub').textContent = reason;
  const mm = Math.floor(G.time / 60), ss = String(Math.floor(G.time % 60)).padStart(2, '0');
  $('end-stats').innerHTML = `
    <div class="stat"><span class="stat-num">${mm}:${ss}</span><span class="stat-label">Battle time</span></div>
    <div class="stat"><span class="stat-num">${s.player.kills}</span><span class="stat-label">Enemies destroyed</span></div>
    <div class="stat"><span class="stat-num">${s.player.unitsTrained}</span><span class="stat-label">Units trained</span></div>
    <div class="stat"><span class="stat-num">${s.player.unitsLost}</span><span class="stat-label">Units lost</span></div>
    <div class="stat"><span class="stat-num">${s.player.buildingsDestroyed}</span><span class="stat-label">Buildings razed</span></div>
    <div class="stat"><span class="stat-num">${s.player.flagsCaptured}</span><span class="stat-label">Flags captured</span></div>`;
  showOverlay('endscreen');
  if (winner === 'player') audio.victory(); else audio.defeat();
}
