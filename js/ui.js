// HUD: War Room (mode/faction/alliance select), menus, command card, build grid, minimap, overlays.
import { G, isPlayerControlled } from './state.js';
import {
  DIFFICULTY, BUILD_DEFS, BUILD_CATEGORIES, UNIT_DEFS, FACTIONS, FACTION_IDS,
  ECONOMY, ALLIANCE_PRESETS
} from './config.js';
import { feedEvent, showToast, hideToast } from './feed.js';
import { renderMinimapBase, terrainHeight, paintFlagCanvas } from './world.js';
import { audio } from './audio.js';
import { spawnBuilding, trySpend } from './commands.js';
import { spawnMoveMarker } from './effects.js';
import { makeBuildingMesh } from './entities.js';
import * as THREE from 'three';

const $ = (id) => document.getElementById(id);

// ---------- Inline SVG icon set ----------
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
  sandbag: svgWrap('<path d="M3 15c1.5-2 4-2 5.5 0M8.5 15c1.5-2 4-2 5.5 0M14 15c1.5-2 4-2 5.5 0"/><path d="M5.5 10.5c1.3-1.8 3.7-1.8 5 0M11 10.5c1.3-1.8 3.7-1.8 5 0"/>'),
  wall: svgWrap('<rect x="3" y="9" width="18" height="8"/><path d="M3 13h18M8 9v4M13 13v4M18 9v4"/>'),
  barrier: svgWrap('<path d="M4 20L12 4l8 16"/><path d="M8.5 14h7"/><path d="M6 20h12"/>'),
  mine: svgWrap('<circle cx="12" cy="14" r="4"/><path d="M12 6v3M5 14h3M19 14h-3M7 9l2 2M17 9l-2 2"/>'),
  tent: svgWrap('<path d="M3 19L12 5l9 14z"/><path d="M12 19v-6"/><path d="M2 19h20"/>'),
  fuel: svgWrap('<path d="M6 21V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v15"/><path d="M4 21h16"/><path d="M16 9h2.5a1.5 1.5 0 0 1 1.5 1.5V17a1.5 1.5 0 0 0 3 0V9.8L20 7"/>'),
  crate: svgWrap('<rect x="3" y="8" width="18" height="11"/><path d="M3 13.5h18M9 8v11M15 8v11"/>'),
  tower: svgWrap('<path d="M7 21L10 5h4l3 16"/><path d="M8.5 12h7M9.5 8h5M6 21h12"/>'),
  gun: svgWrap('<path d="M3 15h11"/><path d="M14 13l6-2M14 17l6 2"/><path d="M6 15v4M18 9v6"/><circle cx="4" cy="15" r="1.4"/>'),
  cannon: svgWrap('<circle cx="8" cy="17" r="2.6"/><path d="M8 17L20 8M10.5 13.5 12 16"/><path d="M3 21h18"/>'),
  bunker: svgWrap('<path d="M4 18v-5l4-5h8l4 5v5z"/><path d="M2 18h20"/><path d="M10 13h4"/>'),
  depot: svgWrap('<path d="M3 20V9l9-5 9 5v11"/><path d="M3 20h18"/><path d="M8 20v-6h8v6"/><path d="M12 9v3"/>'),
  medkit: svgWrap('<rect x="3" y="7" width="18" height="13" rx="1.5"/><path d="M12 10.5v6M9 13.5h6"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>'),
  kitchen: svgWrap('<path d="M4 12h16v4a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z"/><path d="M8 12V8a4 4 0 0 1 8 0"/><path d="M2 12h20"/>'),
  mast: svgWrap('<path d="M12 3v18"/><path d="M8 21h8"/><path d="M12 7 6 3M12 7l6-4M12 12l-5-3M12 12l5-3"/>'),
  net: svgWrap('<path d="M4 5l16 14M4 19L20 5M4 12h16M12 4v16"/>'),
  minefield: svgWrap('<path d="M12 3v4M5 12h4M15 12h4M7.8 7.8l2.4 2.4M16.2 7.8l-2.4 2.4"/><circle cx="12" cy="14" r="5"/><circle cx="12" cy="14" r="1.4" fill="currentColor"/>')
};
const BUILD_ICON = {
  barracks: 'barracks', factory: 'factory',
  sandbag_line: 'sandbag', sandbag_curve: 'sandbag', sandbag_revetment: 'sandbag', sandbag_foxhole: 'sandbag', sandbag_pyramid: 'sandbag',
  log_wall: 'wall', crate_wall: 'crate', tire_stack: 'wall', concrete_wall: 'bunker', steel_wall: 'wall', stone_wall: 'wall',
  rubble_mound: 'wall', dragons_teeth: 'barrier', hedgehog: 'barrier', barbed_wire: 'net', camo_screen: 'net',
  minefield: 'minefield', barrel_cluster: 'fuel',
  trench_line: 'wall', dugout: 'bunker',
  mg_nest: 'gun', sniper_hide: 'gun', mg_bunker: 'bunker', at_pit: 'cannon', at_bunker: 'bunker', cannon_pit: 'cannon', heavy_pillbox: 'bunker', command_bunker: 'hq',
  field_hospital: 'medkit', field_workshop: 'depot', watchtower: 'tower', observation_post: 'tower', radio_mast: 'mast',
  fire_direction: 'arty', ammo_depot: 'depot', fuel_depot: 'fuel', field_kitchen: 'kitchen',
  tent: 'tent', supply_tent: 'tent', camo_tent: 'tent', barracks_tent: 'tent', tent_line: 'tent',
  supply_crates: 'crate', fuel_tank: 'fuel', spare_parts: 'crate', wood_pile: 'crate', barrel_rack: 'fuel', water_tower: 'tower'
};
const factShort = (f) => FACTIONS[f] ? FACTIONS[f].short : f;
const factAdj = (f) => FACTIONS[f] ? FACTIONS[f].adjective : f;
const subjectName = (e) => e.isBuilding
  ? (BUILD_DEFS[e.type]?.name || e.type)
  : (FACTIONS[e.faction] ? FACTIONS[e.faction].units[e.type] : e.type);

// =====================================================
//  WAR ROOM — mode, faction, alliance selection
// =====================================================
function setMenuMode(sandbox) {
  G.sandbox = sandbox;
  document.getElementById('menu').classList.toggle('mode-sandbox', sandbox);
  $('mode-skirmish').classList.toggle('selected', !sandbox);
  $('mode-sandbox').classList.toggle('selected', sandbox);
  $('mode-skirmish').setAttribute('aria-checked', String(!sandbox));
  $('mode-sandbox').setAttribute('aria-checked', String(sandbox));
  $('start-btn').textContent = sandbox ? 'ENTER THE SANDBOX' : 'BEGIN OPERATION';
}

function paintFlagInto(canvas, faction) {
  paintFlagCanvas(canvas, faction);
}

function buildFactionCards() {
  const wrap = $('faction-cards');
  wrap.innerHTML = '';
  for (const f of FACTION_IDS) {
    const F = FACTIONS[f];
    const btn = document.createElement('button');
    btn.className = 'faction-card' + (G.playerFaction === f ? ' selected' : '');
    btn.dataset.faction = f;
    btn.setAttribute('aria-pressed', String(G.playerFaction === f));
    btn.innerHTML = `<canvas class="fc-flag" width="84" height="56"></canvas>
      <span class="fc-body"><span class="fc-name">${F.name}</span><span class="fc-sub">${F.units.tank} · ${F.units.rifle}</span></span>
      <span class="fc-check"><svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" d="M4 12.5l5.5 5.5L20 6.5"/></svg></span>`;
    paintFlagInto(btn.querySelector('canvas'), f);
    btn.addEventListener('click', () => {
      G.playerFaction = f;
      audio.ensure(); audio.uiClick();
      wrap.querySelectorAll('.faction-card').forEach(el => {
        const on = el.dataset.faction === f;
        el.classList.toggle('selected', on);
        el.setAttribute('aria-pressed', String(on));
      });
    });
    wrap.appendChild(btn);
  }
}

const allianceEls = {};
function buildAlliancePresets() {
  const wrap = $('alliance-presets');
  wrap.innerHTML = '';
  for (const preset of ALLIANCE_PRESETS) {
    const btn = document.createElement('button');
    btn.className = 'alliance-preset';
    btn.dataset.preset = preset.id;
    btn.innerHTML = `<span class="ap-name">${preset.label}</span><span class="ap-desc">${preset.desc}</span>`;
    btn.addEventListener('click', () => {
      audio.ensure(); audio.uiClick();
      G.alliances = { ...preset.map };
      markPreset(preset.id);
      syncCustomRows();
    });
    allianceEls[preset.id] = btn;
    wrap.appendChild(btn);
  }
}
function markPreset(id) {
  for (const [pid, el] of Object.entries(allianceEls)) el.classList.toggle('selected', pid === id);
}
function currentPresetId() {
  for (const preset of ALLIANCE_PRESETS) {
    const m = preset.map;
    if (FACTION_IDS.every(f => G.alliances[f] === m[f])) return preset.id;
  }
  return null;
}
const customRows = {};
function buildCustomAlliances() {
  const wrap = $('custom-alliances');
  wrap.innerHTML = '';
  for (const f of FACTION_IDS) {
    const F = FACTIONS[f];
    const row = document.createElement('div');
    row.className = 'custom-row';
    row.innerHTML = `<canvas class="cr-flag" width="42" height="28"></canvas>
      <span class="cr-name">${F.name}</span>
      <span class="cr-seg" role="radiogroup" aria-label="${F.name} team">
        <button class="cr-btn" data-team="A" role="radio">A</button>
        <button class="cr-btn" data-team="B" role="radio">B</button>
        <button class="cr-btn" data-team="ffa" role="radio">FFA</button>
      </span>`;
    paintFlagInto(row.querySelector('canvas'), f);
    row.querySelectorAll('.cr-btn').forEach(b => {
      b.addEventListener('click', () => {
        audio.ensure(); audio.uiClick();
        G.alliances[f] = b.dataset.team;
        markPreset(currentPresetId());
        syncCustomRows();
      });
    });
    customRows[f] = row;
    wrap.appendChild(row);
  }
  syncCustomRows();
}
function syncCustomRows() {
  for (const f of FACTION_IDS) {
    const row = customRows[f];
    if (!row) continue;
    row.querySelectorAll('.cr-btn').forEach(b => {
      const on = G.alliances[f] === b.dataset.team;
      b.classList.toggle('selected', on);
      b.setAttribute('aria-checked', String(on));
    });
  }
}

export function paintFactionBadge() {
  const canvas = $('faction-flag');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (G.sandbox) {
    ctx.fillStyle = '#141410'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#d6b25e'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
    ctx.fillStyle = '#d6b25e';
    ctx.beginPath();
    const cx = canvas.width / 2, cy = canvas.height / 2, R = 11, r = 4.6;
    for (let i = 0; i < 10; i++) {
      const ang = -Math.PI / 2 + (i * Math.PI) / 5, rad = i % 2 === 0 ? R : r;
      const x = cx + Math.cos(ang) * rad, y = cy + Math.sin(ang) * rad;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fill();
    return;
  }
  paintFlagInto(canvas, G.playerFaction);
}

// =====================================================
//  Event wiring
// =====================================================
export function initUI() {
  $('start-btn').addEventListener('click', () => {
    audio.ensure(); audio.resume(); audio.uiClick();
    window.__startOperation && window.__startOperation();
  });
  $('mode-skirmish').addEventListener('click', () => { audio.ensure(); audio.uiClick(); setMenuMode(false); });
  $('mode-sandbox').addEventListener('click', () => { audio.ensure(); audio.uiClick(); setMenuMode(true); });
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

  // War Room construction
  buildFactionCards();
  buildAlliancePresets();
  buildCustomAlliances();
  markPreset(currentPresetId() || 'historic');
  $('alliance-custom').addEventListener('click', () => {
    audio.ensure(); audio.uiClick();
    const panel = $('custom-alliances');
    const open = !panel.classList.contains('hidden');
    panel.classList.toggle('hidden', open);
    $('alliance-custom').setAttribute('aria-pressed', String(!open));
    $('alliance-custom').classList.toggle('open', !open);
  });
  setMenuMode(false);

  // Placement-hint tap cancels placement (touch-friendly)
  $('placement-hint').addEventListener('click', () => { exitPlacementMode(); });

  // Minimap jump
  const mm = $('minimap');
  const jump = (e) => {
    const rect = mm.getBoundingClientRect();
    const cx = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const cy = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    const wx = (cx / rect.width - 0.5) * 320;
    const wz = (cy / rect.height - 0.5) * 320;
    G.cam.target.set(wx, terrainHeight(wx, wz), wz);
  };
  mm.addEventListener('mousedown', jump);
  mm.addEventListener('touchstart', jump, { passive: true });

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

// =====================================================
//  Ghost preview while placing
// =====================================================
let ghost = null, ghostValid = false, ghostRing = null;
export function enterPlacementMode(key) {
  G.placingBuilding = key;
  const def = BUILD_DEFS[key];
  $('placement-hint').textContent = `Placing ${def.name} — tap the map to build · tap here / right-click / Esc to cancel`;
  $('placement-hint').classList.remove('hidden');
  ensureGhost();
}
export function exitPlacementMode() {
  G.placingBuilding = null;
  $('placement-hint').classList.add('hidden');
  if (ghost) { G.scene.remove(ghost); ghost.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); }); ghost = null; }
  if (ghostRing) { G.scene.remove(ghostRing); ghostRing.geometry.dispose(); ghostRing.material.dispose(); ghostRing = null; }
}

function ensureGhost() {
  if (ghost) return;
  ghost = makeBuildingMesh(G.placementFaction || G.playerFaction || 'usa', G.placingBuilding);
  ghost.traverse(o => {
    if (!o.isMesh) return;
    o.material = o.material.clone();
    o.material.transparent = true;
    o.material.opacity = 0.5;
    o.material.depthWrite = false;
    o.castShadow = false;
  });
  const ringGeo = new THREE.RingGeometry(BUILD_DEFS[G.placingBuilding].radius + 0.4, BUILD_DEFS[G.placingBuilding].radius + 1.1, 36);
  ringGeo.rotateX(-Math.PI / 2);
  ghostRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0x8be06a, transparent: true, opacity: 0.85, depthWrite: false }));
  G.scene.add(ghost);
  G.scene.add(ghostRing);
}
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
export function screenToGround(clientX, clientY) {
  const rect = G.renderer.domElement.getBoundingClientRect();
  ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(ndc, G.camera);
  const hit = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(groundPlane, hit)) return null;
  hit.y = terrainHeight(hit.x, hit.z);
  return hit;
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
export function placementValid(x, z, key) {
  const r = BUILD_DEFS[key].radius;
  const B = 160 - r - 2;
  if (Math.abs(x) > B || Math.abs(z) > B) return false;
  for (const b of G.buildings) {
    if (Math.hypot(b.group.position.x - x, b.group.position.z - z) < b.def.radius + r + 1.2) return false;
  }
  for (const f of G.flags) {
    if (Math.hypot(f.x - x, f.z - z) < 11) return false;
  }
  return true;
}
export function clickPlacement(clientX, clientY) {
  const pt = screenToGround(clientX, clientY);
  if (!pt) return;
  const key = G.placingBuilding;
  const def = BUILD_DEFS[key];
  if (!placementValid(pt.x, pt.z, key)) { showToast('Invalid construction site'); audio.alarm(); return; }
  const faction = G.placementFaction || G.playerFaction;
  if (!trySpend(faction, def.cost)) { showToast('Insufficient requisition'); audio.alarm(); return; }
  spawnBuilding(faction, key, pt.x, pt.z, false);
  feedEvent(`${def.name} under construction`, faction);
  audio.build();
  exitPlacementMode();
}

// =====================================================
//  Production
// =====================================================
export function trainUnit(building, type) {
  const def = UNIT_DEFS[type];
  if (building.queue.length >= 5) { showToast('Production queue full'); return; }
  const faction = building.faction;
  const count = G.units.filter(u => u.faction === faction).length + queuedCount(faction);
  if (count >= ECONOMY.unitCap) { showToast('Unit cap reached for this power'); return; }
  if (!trySpend(faction, def.cost)) { showToast('Insufficient requisition'); audio.alarm(); return; }
  building.queue.push({ type, t: def.buildTime, total: def.buildTime });
  audio.build();
  refreshCommandCard();
}
function queuedCount(faction) {
  let n = 0;
  for (const b of G.buildings) if (b.faction === faction) for (const q of b.queue) n++;
  return n;
}

// =====================================================
//  Selection panel + command card + build grid
// =====================================================
let buildTab = 'production';
const selectedProducer = () => {
  const s = G.selection;
  return s.length === 1 && s[0].isBuilding ? s[0] : null;
};
const selectedSingle = () => (G.selection.length === 1 ? G.selection[0] : null);

function selectionHeader() {
  const counts = {};
  for (const e of G.selection) if (!e.isBuilding) counts[e.type] = (counts[e.type] || 0) + 1;
  return Object.entries(counts).map(([t, n]) => `${FACTIONS[G.selection[0].faction].units[t]} ×${n}`).join('  ·  ');
}

export function refreshCommandCard() {
  const btnWrap = $('cc-buttons');
  btnWrap.innerHTML = '';
  const tabsEl = $('build-tabs');
  const gridEl = $('fort-grid');

  const sel = G.selection;
  const single = selectedSingle();

  // ---- Selection summary
  if (!sel.length) {
    $('cc-title').textContent = 'FIELD COMMAND';
    $('sel-name').textContent = 'No selection';
    $('sel-sub').textContent = 'Drag a box or click a unit';
    $('sel-hp-fill').style.width = '0%';
    $('sel-portrait').innerHTML = ICONS.hq;
    $('sel-portrait').classList.add('empty');
    $('sel-portrait').style.color = '';
    btnWrap.innerHTML = '<div class="cc-hint">Select a unit or building.<br><span>Right-click: move / attack / capture · A: attack-move · S: stop · H: hold</span></div>';
    tabsEl.classList.add('hidden'); gridEl.classList.add('hidden');
    return;
  }

  if (single) {
    const e = single;
    const F = FACTIONS[e.faction];
    const factionTag = document.createElement('span'); // composed below
    $('sel-name').textContent = `${F ? F.short + ' · ' : ''}${subjectName(e)}`;
    $('sel-hp-fill').style.width = `${Math.max(0, (e.hp / e.maxHp) * 100)}%`;
    $('sel-portrait').classList.remove('empty');
    $('sel-portrait').style.color = F ? F.uiColor : '';
    if (e.isBuilding) {
      $('sel-portrait').innerHTML = e.type === 'hq' ? ICONS.hq : e.type === 'barracks' ? ICONS.barracks : e.type === 'factory' ? ICONS.factory : (ICONS[BUILD_ICON[e.type]] || ICONS.bunker);
      const def = e.def;
      const under = e.buildProgress < 1 ? `Under construction — ${Math.floor(e.buildProgress * 100)}%` : `${Math.ceil(e.hp)} / ${e.maxHp} HP`;
      $('sel-sub').textContent = def.desc ? `${under} · ${def.desc}` : under;
      $('cc-title').textContent = e.type === 'hq' ? 'HEADQUARTERS' : (BUILD_DEFS[e.type]?.name || 'STRUCTURE').toUpperCase();
    } else {
      $('sel-portrait').innerHTML = ICONS[e.type];
      $('cc-title').textContent = 'UNIT COMMAND';
      $('sel-sub').textContent = `${Math.ceil(e.hp)} / ${e.maxHp} HP · ${e.kills || 0} kills · ${e.stance === 'hold' ? 'Holding' : 'Free fire'}`;
    }
  } else {
    $('sel-portrait').innerHTML = ICONS.tank;
    $('sel-portrait').classList.remove('empty');
    $('sel-name').textContent = `${sel.length} units selected`;
    $('sel-sub').textContent = selectionHeader();
    const avg = sel.reduce((a, e) => a + e.hp / e.maxHp, 0) / sel.length;
    $('sel-hp-fill').style.width = `${avg * 100}%`;
    $('sel-portrait').style.color = '';
    $('cc-title').textContent = 'GROUP COMMAND';
  }

  // ---- Action area
  const producer = selectedProducer();
  const isHQ = producer && producer.type === 'hq' && producer.buildProgress >= 1;
  if (isHQ) {
    renderBuildTabs(producer);
    return;
  }
  tabsEl.classList.add('hidden');
  gridEl.classList.add('hidden');

  if (producer && producer.buildProgress >= 1 && producer.def.trains) {
    const trains = producer.def.trains;
    trains.forEach((type, i) => {
      addButton(btnWrap, {
        icon: ICONS[type], label: FACTIONS[producer.faction].units[type],
        cost: UNIT_DEFS[type].cost, hotkey: i === 0 ? 'Q' : 'W',
        onClick: () => trainUnit(producer, type)
      });
    });
    renderQueue(btnWrap, producer);
    return;
  }
  const hasUnits = sel.some(e => !e.isBuilding);
  if (hasUnits) {
    addButton(btnWrap, { icon: ICONS.attackmove, label: 'Attack-Move', hotkey: 'A', onClick: () => { G.attackMoveMode = true; showToast('Attack-move — click a destination'); } });
    addButton(btnWrap, { icon: ICONS.stop, label: 'Stop', hotkey: 'S', onClick: () => { stopSelection(); } });
    addButton(btnWrap, { icon: ICONS.hold, label: 'Hold Position', hotkey: 'H', onClick: () => { toggleHoldSelection(); } });
    return;
  }
  btnWrap.innerHTML = '<div class="cc-hint">Structure selected.<br><span>No production available here.</span></div>';
}

function stopSelection() {
  for (const e of G.selection) {
    if (e.isBuilding) continue;
    e.order = { kind: 'idle', x: e.group.position.x, z: e.group.position.z };
    e.anchor = { x: e.group.position.x, z: e.group.position.z };
    e.target = null;
  }
  audio.uiClick();
}
function toggleHoldSelection() {
  for (const e of G.selection) if (!e.isBuilding) e.stance = e.stance === 'hold' ? 'fire' : 'hold';
  audio.uiClick();
  refreshCommandCard();
}
export const __internals = { stopSelection, toggleHoldSelection };

function renderBuildTabs(hq) {
  const tabsEl = $('build-tabs');
  const gridEl = $('fort-grid');
  tabsEl.innerHTML = '';
  gridEl.innerHTML = '';
  tabsEl.classList.remove('hidden');
  gridEl.classList.remove('hidden');
  for (const cat of BUILD_CATEGORIES) {
    const btn = document.createElement('button');
    btn.className = 'build-tab' + (buildTab === cat.id ? ' selected' : '');
    btn.textContent = cat.label.toUpperCase();
    btn.addEventListener('click', () => { audio.uiClick(); buildTab = cat.id; renderBuildTabs(hq); });
    tabsEl.appendChild(btn);
  }
  const items = Object.entries(BUILD_DEFS).filter(([, d]) => d.cat === buildTab);
  for (const [key, def] of items) {
    const afford = G.player.req >= def.cost;
    const btn = document.createElement('button');
    btn.className = 'fort-btn' + (afford ? '' : ' disabled');
    btn.title = `${def.name} — ${def.cost} REQ · ${def.desc || ''}`;
    btn.innerHTML = `<span class="fort-icon">${ICONS[BUILD_ICON[key]] || ICONS.wall}</span><span class="fort-name">${def.name}</span><span class="fort-cost">${def.cost}</span>`;
    btn.addEventListener('click', () => {
      if (G.player.req < def.cost) { showToast('Insufficient requisition'); audio.alarm(); return; }
      audio.uiClick();
      G.placementFaction = hq.faction;
      enterPlacementMode(key);
    });
    gridEl.appendChild(btn);
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

export function tickCommandCard() {
  const producer = selectedProducer();
  if (producer) refreshCommandCard();
}

// =====================================================
//  Minimap
// =====================================================
let minimapBase = null;
let minimapTimer = 0;
const FACTION_PIP_COLOR = { usa: '#a8d088', ussr: '#ff8a6a', germany: '#e8e8e8', japan: '#ffc060', france: '#8ac0ff' };
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
  const toPx = (x, z) => [ (x / 320 + 0.5) * S, (z / 320 + 0.5) * S ];
  // Flags
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const f of G.flags) {
    const [x, y] = toPx(f.x, f.z);
    ctx.beginPath();
    ctx.arc(x, y, 6.2, 0, Math.PI * 2);
    ctx.fillStyle = f.owner === 'neutral' ? '#d8d5c8' : FACTION_PIP_COLOR[f.owner] || '#d8d5c8';
    ctx.fill();
    ctx.strokeStyle = '#101008'; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.fillStyle = '#141410'; ctx.font = 'bold 7px Arial'; ctx.fillText(f.id, x, y + 0.5);
  }
  // Buildings (all five powers)
  for (const b of G.buildings) {
    const [x, y] = toPx(b.group.position.x, b.group.position.z);
    ctx.fillStyle = FACTION_PIP_COLOR[b.faction] || '#fff';
    const s = b.type === 'hq' ? 6.5 : 4;
    ctx.fillRect(x - s / 2, y - s / 2, s, s);
    ctx.strokeStyle = '#0d0d08'; ctx.lineWidth = 1; ctx.strokeRect(x - s / 2, y - s / 2, s, s);
  }
  // Units
  for (const u of G.units) {
    const [x, y] = toPx(u.group.position.x, u.group.position.z);
    ctx.fillStyle = FACTION_PIP_COLOR[u.faction] || '#fff';
    ctx.fillRect(x - 1.3, y - 1.3, 2.6, 2.6);
  }
  // Camera frustum
  const cam = G.cam;
  const [cx, cy] = toPx(cam.target.x, cam.target.z);
  const halfW = (cam.dist * 0.62 / 320) * S;
  const halfH = (cam.dist * 0.40 / 320) * S;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-cam.azimuth + Math.PI);
  ctx.strokeStyle = 'rgba(255,233,160,0.9)'; ctx.lineWidth = 1.4;
  ctx.strokeRect(-halfW, -halfH, halfW * 2, halfH * 2);
  ctx.restore();
}

// =====================================================
//  Top bar / pips / timer
// =====================================================
export function tickHUD(dt) {
  if (G.toast) {
    G.toast.t -= dt;
    if (G.toast.t <= 0) hideToast();
  }
  $('req-count').textContent = Math.floor(G.player.req);
  $('req-income').textContent = `+${G.player.income.toFixed(1)}/s`;
  for (const f of G.flags) {
    const pip = $('pip-' + f.id);
    if (!pip) continue;
    pip.classList.remove('pip-neutral', 'pip-owned', 'pip-contested');
    pip.classList.add(f.owner === 'neutral' ? 'pip-neutral' : 'pip-owned', ...(f.contested ? ['pip-contested'] : []));
    pip.style.background = f.owner === 'neutral' ? '' : (FACTION_PIP_COLOR[f.owner] || '#9dc08b');
    pip.title = `${f.id} — ${f.label}: ${f.owner === 'neutral' ? 'Neutral' : FACTIONS[f.owner].name}`;
  }
  if (G.sandbox) {
    $('game-timer').textContent = 'SANDBOX';
    $('game-timer').classList.add('timer-sandbox');
  } else {
    if (G.mode === 'playing') G.timeLeft = Math.max(0, G.timeLeft - dt);
    const t = Math.floor(G.timeLeft);
    $('game-timer').textContent = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
    $('game-timer').classList.remove('timer-sandbox');
  }
}

// =====================================================
//  Overlays
// =====================================================
export function showOverlay(id) { $(id).classList.remove('hidden'); }
export function hideOverlay(id) { $(id).classList.add('hidden'); }

export function endGame(winner, reason) {
  G.mode = 'over';
  const skirmish = !G.sandbox;
  const myStats = skirmish ? G.stats.perFaction[G.playerFaction] : Object.values(G.stats.perFaction).reduce((a, s) => ({ kills: a.kills + s.kills, unitsTrained: a.unitsTrained + s.unitsTrained, unitsLost: a.unitsLost + s.unitsLost, buildingsDestroyed: a.buildingsDestroyed + s.buildingsDestroyed, flagsCaptured: a.flagsCaptured + s.flagsCaptured }), { kills: 0, unitsTrained: 0, unitsLost: 0, buildingsDestroyed: 0, flagsCaptured: 0 });
  $('end-title').textContent = winner === 'player' ? 'VICTORY' : 'DEFEAT';
  $('end-title').className = winner === 'player' ? 'end-title victory' : 'end-title defeat';
  $('end-sub').textContent = reason;
  const mm = Math.floor(G.time / 60), ss = String(Math.floor(G.time % 60)).padStart(2, '0');
  $('end-stats').innerHTML = `
    <div class="stat"><span class="stat-num">${mm}:${ss}</span><span class="stat-label">Battle time</span></div>
    <div class="stat"><span class="stat-num">${myStats.kills}</span><span class="stat-label">Enemies destroyed</span></div>
    <div class="stat"><span class="stat-num">${myStats.unitsTrained}</span><span class="stat-label">Units trained</span></div>
    <div class="stat"><span class="stat-num">${myStats.unitsLost}</span><span class="stat-label">Units lost</span></div>
    <div class="stat"><span class="stat-num">${myStats.buildingsDestroyed}</span><span class="stat-label">Buildings razed</span></div>
    <div class="stat"><span class="stat-num">${myStats.flagsCaptured}</span><span class="stat-label">Flags captured</span></div>`;
  showOverlay('endscreen');
  if (winner === 'player') audio.victory(); else audio.defeat();
}
