import { WORLD, FACTIONS, FACTION_ORDER, UNIT_ORDER, getUnitDef } from './data.js';
import { createWorld } from './world.js';
import { Game } from './game.js';
import { Renderer } from './render.js';
import { AudioEngine } from './audio.js';

const $ = id => document.getElementById(id);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const canvas = $('game-canvas');
const world = createWorld();
const audio = new AudioEngine();
let game = new Game(world);
game.setAudio(audio);
const renderer = new Renderer(canvas, game, world);

let selectedStartFaction = 'germany';
let started = false;
let gameOverShown = false;
let manualWasPaused = false;
let soundOn = true;
let lastHudUpdate = 0;
let lastDossierUpdate = 0;
let lastMinimapUpdate = 0;
let lastDossierSignature = '';
const seenNotices = new Set();
const teamElements = new Map();
const keys = new Set();
let pointerDown = null;
let panState = null;
let selectionBox = null;
let lastClick = { time: 0, unitId: null };
let minimapDragging = false;
let targetPointer = null;

const touch = {
  points: new Map(),
  lastMid: null,
  lastDistance: 0,
  moved: false,
  suppressTap: false
};

const UNIT_KEYS = { z: 'rifle', x: 'mg', c: 'art', v: 'cav', b: 'special' };
const UNIT_HOTKEYS = ['Z', 'X', 'C', 'V', 'B'];

function flagSvg(id, className = '') {
  const common = `class="flag ${className}" viewBox="0 0 60 36" role="img" aria-label="${FACTIONS[id].name} flag"`;
  if (id === 'germany') {
    return `<svg ${common}><rect width="60" height="12" fill="#1c1c1c"/><rect y="12" width="60" height="12" fill="#e9e4d2"/><rect y="24" width="60" height="12" fill="#aa2e33"/><path d="M8 20h44" stroke="#c9a760" stroke-width=".6" opacity=".55"/></svg>`;
  }
  if (id === 'france') {
    return `<svg ${common}><rect width="20" height="36" fill="#25457c"/><rect x="20" width="20" height="36" fill="#e9e4d7"/><rect x="40" width="20" height="36" fill="#a82f3b"/></svg>`;
  }
  if (id === 'austria') {
    return `<svg ${common}><rect width="60" height="12" fill="#a62c38"/><rect y="12" width="60" height="12" fill="#eee9da"/><rect y="24" width="60" height="12" fill="#a62c38"/><circle cx="30" cy="18" r="5.2" fill="#c5a14f"/><path d="M30 14v8M27.8 17h4.4M28.6 20.4h2.8" stroke="#6d4a25" stroke-width=".8"/></svg>`;
  }
  if (id === 'russia') {
    return `<svg ${common}><rect width="60" height="12" fill="#ede9dc"/><rect y="12" width="60" height="12" fill="#28467a"/><rect y="24" width="60" height="12" fill="#a62d35"/></svg>`;
  }
  return `<svg ${common}><rect width="60" height="36" fill="#263f67"/><path d="M0 0l60 36M60 0L0 36" stroke="#eee9db" stroke-width="8"/><path d="M0 0l60 36M60 0L0 36" stroke="#a72e39" stroke-width="3.4"/><path d="M30 0v36M0 18h60" stroke="#eee9db" stroke-width="12"/><path d="M30 0v36M0 18h60" stroke="#a72e39" stroke-width="6.6"/></svg>`;
}

function unitIcon(sprite, special = false) {
  if (sprite === 'tank') {
    return `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 23l3-14 17-1 3 15-9 3-9-1z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 12h16M7 19h18" stroke="currentColor" stroke-width="1" opacity=".55"/><circle cx="16" cy="17" r="4" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M19 17h10" stroke="currentColor" stroke-width="2"/></svg>`;
  }
  if (sprite === 'art') {
    return `<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="10" cy="23" r="4.3" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M4 28l7-6M12 20l15-12" stroke="currentColor" stroke-width="1.5"/><path d="M15 20l4 2M17 18l4 2M8 25l2 2" stroke="currentColor" stroke-width="1"/><path d="M17 17l9-7" stroke="currentColor" stroke-width="2.4"/></svg>`;
  }
  if (sprite === 'mg') {
    return `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M8 9h13l3 3-7 2-6-1z" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M17 15l6 10M17 15l-3 11M17 15l-8 9" stroke="currentColor" stroke-width="1.3"/><path d="M21 11h8" stroke="currentColor" stroke-width="1.9"/><circle cx="14" cy="12" r="1.3" fill="currentColor"/></svg>`;
  }
  if (sprite === 'cav') {
    return `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 18c2-4 7-6 12-5l5 2 3-3 1 4-3 4-6 2-5 5-2-1 3-5-6 1z" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M10 25l-2 4M17 25l1 4M9 11l3-4 2 5" stroke="currentColor" stroke-width="1.2"/><circle cx="12" cy="9" r="2" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>`;
  }
  return `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 27L25 7" stroke="currentColor" stroke-width="2"/><path d="M7 24l4 4M22 5l4 4M18 8l7 7" stroke="currentColor" stroke-width="1.2"/><circle cx="21" cy="7" r="2.4" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>`;
}

function initUI() {
  renderer.resize(window.innerWidth, window.innerHeight);
  buildStartFactions();
  buildFactionRail();
  buildRecruitCards();
  updateStartDoctrine();
  updateHUD(0, true);
  updateDossier(true);
  updateMobileBar();
}

function buildStartFactions() {
  const root = $('start-factions');
  root.innerHTML = FACTION_ORDER.map(id => {
    const faction = FACTIONS[id];
    return `
      <button type="button" role="option" data-start-team="${id}" class="start-faction ${id === selectedStartFaction ? 'selected' : ''}" style="--faction:${faction.color};--accent:${faction.accent}">
        <span class="start-faction-flag">${flagSvg(id)}</span>
        <span class="start-faction-copy">
          <b>${faction.short}</b>
          <small>${faction.doctrine}</small>
        </span>
        <span class="start-faction-check">${id === selectedStartFaction ? '◆' : '◇'}</span>
      </button>`;
  }).join('');
}

function updateStartDoctrine() {
  const faction = FACTIONS[selectedStartFaction];
  $('start-doctrine').innerHTML = `
    <div class="doctrine-flag">${flagSvg(selectedStartFaction)}</div>
    <div class="doctrine-copy">
      <div class="doctrine-kicker">${faction.leader}</div>
      <div class="doctrine-title">${faction.doctrine}</div>
      <p>${faction.quote}</p>
    </div>
    <div class="doctrine-bonus"><span>DOCTRINE</span><b>${faction.bonus}</b></div>`;
}

function buildFactionRail() {
  const rail = $('faction-rail');
  rail.innerHTML = FACTION_ORDER.map((id, index) => {
    const faction = FACTIONS[id];
    return `
      <button type="button" class="faction-tab" data-team="${id}" style="--faction:${faction.color};--accent:${faction.accent}" title="Command ${faction.name} (${index + 1})">
        <span class="tab-index">${index + 1}</span>
        <span class="tab-flag">${flagSvg(id)}</span>
        <span class="tab-copy"><b>${faction.short}</b><small><span class="tab-sectors">3</span> SECTORS</small></span>
        <span class="tab-status">AI</span>
      </button>`;
  }).join('');
  teamElements.clear();
  rail.querySelectorAll('[data-team]').forEach(element => teamElements.set(element.dataset.team, element));
}

function buildRecruitCards() {
  const root = $('recruit-cards');
  const factionId = game.activeId;
  root.innerHTML = UNIT_ORDER.map((key, index) => {
    const def = getUnitDef(factionId, key);
    return `
      <button type="button" class="unit-card" data-unit="${key}" style="--faction:${FACTIONS[factionId].color}" title="${def.desc}">
        <span class="unit-card-icon">${unitIcon(def.sprite, key === 'special')}</span>
        <span class="unit-card-copy">
          <b>${def.name}</b>
          <small>${def.role}</small>
        </span>
        <span class="unit-card-foot"><span class="unit-cost"><i>REQ</i> ${def.cost}</span><span class="unit-hotkey">${UNIT_HOTKEYS[index]}</span></span>
      </button>`;
  }).join('');
  updateRecruitCards();
}

function updateRecruitCards() {
  const root = $('recruit-cards');
  if (!root) return;
  const team = game.activeTeam;
  const cap = game.unitCap(game.activeId);
  const count = game.livingUnits(game.activeId).length;
  root.querySelectorAll('[data-unit]').forEach(card => {
    const key = card.dataset.unit;
    const def = getUnitDef(game.activeId, key);
    const blocked = !game.running || game.paused || game.over || team.resources < def.cost || count >= cap;
    card.classList.toggle('disabled', blocked);
    card.disabled = blocked;
    card.setAttribute('aria-disabled', blocked ? 'true' : 'false');
  });
  const spawn = game.getSpawnSector(game.activeId);
  $('deploy-name').textContent = spawn ? `DEPLOY TO ${spawn.name.toUpperCase()}` : 'NO DEPLOYMENT SECTOR';
  $('queue-note').textContent = count >= cap ? 'FIELD ARMY AT CAPACITY · TAKE A SECTOR' : `${count} / ${cap} FIELD ARMY`;
}

function updateHUD(now, force = false) {
  if (!force && now - lastHudUpdate < 120) return;
  lastHudUpdate = now;
  if (!started || game.over) return;
  const team = game.activeTeam;
  if (!team) return;
  const count = game.teamSectorCount(game.activeId);
  const cap = game.unitCap(game.activeId);
  $('res-requisition').textContent = Math.floor(team.resources);
  $('res-army').textContent = `${game.livingUnits(game.activeId).length} / ${cap}`;
  $('res-sectors').textContent = `${count}`;
  $('objective-count').textContent = `${count} / 11`;
  $('objective-fill').style.width = `${clamp(count / 11, 0, 1) * 100}%`;
  const faction = FACTIONS[game.activeId];
  document.documentElement.style.setProperty('--active-faction', faction.color);

  const barrageIn = game.barrageReadyIn();
  const ability = $('barrage-btn');
  ability.classList.toggle('cooling', barrageIn > 0);
  ability.classList.toggle('targeting', game.targeting === 'barrage');
  ability.disabled = barrageIn > 0 || !game.running || game.paused || game.over;
  $('ability-cd').textContent = barrageIn > 0 ? `${Math.ceil(barrageIn)}s` : 'READY';

  for (const [id, element] of teamElements) {
    const factionTeam = game.teams[id];
    element.classList.toggle('active', id === game.activeId);
    element.classList.toggle('dead', !factionTeam.alive);
    element.querySelector('.tab-sectors').textContent = game.teamSectorCount(id);
    element.querySelector('.tab-status').textContent = !factionTeam.alive ? 'FALLEN' : id === game.activeId ? 'YOU' : 'AI';
  }

  if (game.armistice) {
    $('armistice-banner').classList.remove('hidden');
    $('armistice-text').textContent = `${FACTIONS[game.armistice.teamId].short} is breaking the line`;
    $('armistice-count').textContent = Math.ceil(game.armistice.remaining);
    $('armistice-banner').style.setProperty('--tone', FACTIONS[game.armistice.teamId].color);
  } else {
    $('armistice-banner').classList.add('hidden');
  }

  updateRecruitCards();
  updateMobileBar();
}

function updateDossier(force = false) {
  if (!started) return;
  const now = performance.now();
  if (!force && now - lastDossierUpdate < 220) return;
  const units = game.selectedUnits;
  const sector = game.selectedSector;
  const sig = [
    game.activeId,
    units.map(unit => `${unit.id}:${Math.round(unit.hp / 4)}`).sort().join(','),
    sector?.id || '',
    game.log.length,
    game.over ? 'over' : ''
  ].join('|');
  if (!force && sig === lastDossierSignature && now - lastDossierUpdate < 700) return;
  lastDossierSignature = sig;
  lastDossierUpdate = now;
  const body = $('dossier-body');

  if (units.length) {
    $('dossier-kind').textContent = units.length > 1 ? 'FORMATION' : 'REGIMENT';
    if (units.length === 1) {
      const unit = units[0];
      const faction = FACTIONS[unit.teamId];
      const def = unit.def;
      const hp = Math.max(0, Math.ceil(unit.hp));
      const ratio = clamp(unit.hp / unit.maxHp, 0, 1);
      const status = unit.entrench > 0.8 ? 'ENTRENCHED' : unit.suppress > 58 ? 'SUPPRESSED' : unit.moving ? 'MOVING' : unit.underFire ? 'UNDER FIRE' : 'HOLDING';
      body.innerHTML = `
        <div class="dossier-unit">
          <div class="unit-banner" style="--faction:${faction.color}">
            <span class="unit-banner-icon">${unitIcon(def.sprite, def.key === 'special')}</span>
            <div class="unit-banner-copy">
              <span>${faction.short.toUpperCase()} · ${def.role.toUpperCase()}</span>
              <h3>${def.name}</h3>
            </div>
            <div class="unit-hp">${hp}<small>/${Math.ceil(unit.maxHp)}</small></div>
          </div>
          <div class="hp-track hp-large"><i style="width:${ratio * 100}%;--hp:${faction.color}"></i></div>
          <div class="unit-stat-grid">
            <div><span>FIREPOWER</span><b>${Math.round(def.dmg * 10) / 10}</b></div>
            <div><span>RANGE</span><b>${def.range}</b></div>
            <div><span>SPEED</span><b>${Math.round(def.speed)}</b></div>
            <div><span>CAPTURE</span><b>${def.capture || '—'}</b></div>
          </div>
          <div class="unit-status-row">
            <span class="status-pill ${unit.entrench > 0.8 ? 'good' : ''}">${status}</span>
            <span class="status-pill">${unit.suppress > 58 ? 'PINNED' : 'DISCIPLINE OK'}</span>
          </div>
          <div class="order-grid">
            <button type="button" data-action="dig">DIG IN <kbd>H</kbd></button>
            <button type="button" data-action="stop">STOP <kbd>S</kbd></button>
            <button type="button" data-action="hold">HOLD GROUND</button>
            <button type="button" data-action="focus">LOCATE <kbd>F</kbd></button>
          </div>
          <p class="unit-flavour">${def.desc}</p>
        </div>`;
    } else {
      const counts = {};
      let hp = 0;
      let maxHp = 0;
      for (const unit of units) {
        counts[unit.def.name] = (counts[unit.def.name] || 0) + 1;
        hp += unit.hp;
        maxHp += unit.maxHp;
      }
      const ratio = clamp(hp / maxHp, 0, 1);
      const faction = FACTIONS[game.activeId];
      body.innerHTML = `
        <div class="dossier-group">
          <div class="group-header">
            <div><span>${faction.short.toUpperCase()} · FIELD FORMATION</span><h3>${units.length} Regiments Selected</h3></div>
            <div class="unit-hp">${Math.round(ratio * 100)}<small>%</small></div>
          </div>
          <div class="hp-track hp-large"><i style="width:${ratio * 100}%;--hp:${faction.color}"></i></div>
          <div class="composition">
            ${Object.entries(counts).map(([name, number]) => `<span>${number}× <b>${name}</b></span>`).join('')}
          </div>
          <div class="order-grid">
            <button type="button" data-action="dig">DIG IN <kbd>H</kbd></button>
            <button type="button" data-action="stop">STOP <kbd>S</kbd></button>
            <button type="button" data-action="hold">HOLD GROUND</button>
            <button type="button" data-action="focus">LOCATE <kbd>F</kbd></button>
          </div>
          <p class="unit-flavour">Right-click the field to give a movement order. Right-click an enemy to attack. Tap ground on touch.</p>
        </div>`;
    }
    return;
  }

  if (sector) {
    $('dossier-kind').textContent = sector.capital ? 'CAPITAL' : 'SECTOR';
    const owner = sector.owner ? FACTIONS[sector.owner] : null;
    const garrison = game.units.filter(unit => !unit.dead && Math.hypot(unit.x - sector.x, unit.y - sector.y) < sector.radius);
    const own = sector.owner === game.activeId;
    body.innerHTML = `
      <div class="sector-dossier">
        <div class="sector-head" style="--faction:${owner?.color || '#8f886f'}">
          <span class="sector-flag">${owner ? flagSvg(sector.owner) : ''}</span>
          <div><span>${sector.sub.toUpperCase()}</span><h3>${sector.name}</h3></div>
          ${sector.capital ? '<span class="capital-mark">CAPITAL</span>' : ''}
        </div>
        <div class="sector-owner-line"><span>CONTROLLED BY</span><b style="color:${owner?.colorLight || '#d4c9ad'}">${owner ? owner.name : 'No man’s land'}</b></div>
        <div class="capture-line">
          <div class="capture-copy"><span>${sector.contested ? 'CONTESTED' : sector.captureTeam ? 'CAPTURE IN PROGRESS' : 'LINE STABLE'}</span><b>${Math.round(sector.progress)}%</b></div>
          <div class="hp-track"><i style="width:${sector.progress}%;--hp:${sector.captureTeam ? FACTIONS[sector.captureTeam].color : '#b4a67e'}"></i></div>
        </div>
        <div class="sector-stats">
          <div><span>INCOME</span><b>+${game.sectorIncome(sector.owner || game.activeId).toFixed(1)}/s</b></div>
          <div><span>GARRISON</span><b>${garrison.length}</b></div>
          <div><span>RADIUS</span><b>${sector.radius}m</b></div>
        </div>
        <div class="order-grid">
          <button type="button" data-action="focus-sector" data-sector="${sector.id}">LOCATE SECTOR</button>
          ${own ? `<button type="button" class="accent" data-action="deploy" data-sector="${sector.id}">DEPLOY HERE</button>` : ''}
        </div>
        <p class="unit-flavour">${sector.contested ? 'Enemy troops are inside the sector. Clear them before capture can continue.' : own ? 'Infantry and cavalry stationed here can be recruited directly to this sector.' : 'Move infantry or cavalry into the circle to take this sector. Artillery cannot capture ground.'}</p>
      </div>`;
    return;
  }

  $('dossier-kind').textContent = 'WAR ROOM';
  const faction = game.activeFaction;
  const log = game.log.slice(0, 4).map(entry => `<li class="${entry.teamId ? 'log-' + entry.teamId : ''}"><span>${entry.text}</span></li>`).join('');
  body.innerHTML = `
    <div class="war-room">
      <div class="war-faction" style="--faction:${faction.color}">
        <span class="war-flag">${flagSvg(game.activeId)}</span>
        <div><span>UNDER YOUR COMMAND</span><h3>${faction.name}</h3></div>
      </div>
      <div class="doctrine-block">
        <span>DOCTRINE</span>
        <b>${faction.doctrine}</b>
        <p>${faction.bonus}</p>
      </div>
      <div class="war-stats">
        <div><span>INCOME</span><b>+${game.sectorIncome(game.activeId).toFixed(1)}/s</b></div>
        <div><span>WAR CHEST</span><b>${Math.floor(game.activeTeam.resources)}</b></div>
        <div><span>ARMY CAP</span><b>${game.unitCap(game.activeId)}</b></div>
      </div>
      <div class="war-objective">
        <div><span>DOMINATION</span><b>${game.teamSectorCount(game.activeId)} / 11 SECTORS</b></div>
        <div class="hp-track"><i style="width:${clamp(game.teamSectorCount(game.activeId) / 11, 0, 1) * 100}%;--hp:${faction.color}"></i></div>
      </div>
      <div class="war-log">
        <span>DISPATCHES</span>
        <ul>${log || '<li><span>The front is quiet. For now.</span></li>'}</ul>
      </div>
      <p class="war-note">All five empires answer to you. Press <kbd>1</kbd>–<kbd>5</kbd> or click a banner to switch command.</p>
    </div>`;
}

function updateMobileBar() {
  const label = $('mobile-selected-label');
  const sub = $('mobile-selected-sub');
  const units = game.selectedUnits;
  if (units.length === 1) {
    label.textContent = units[0].def.name.toUpperCase();
    sub.textContent = `${Math.ceil(units[0].hp)} HP · ${units[0].order.type.toUpperCase()}`;
  } else if (units.length > 1) {
    label.textContent = `${units.length} REGIMENTS`;
    sub.textContent = 'TAP GROUND TO ADVANCE · TAP ENEMY TO ATTACK';
  } else if (game.selectedSector) {
    label.textContent = game.selectedSector.name.toUpperCase();
    sub.textContent = game.selectedSector.owner ? `${FACTIONS[game.selectedSector.owner].short.toUpperCase()} SECTOR` : 'NO MAN’S LAND';
  } else {
    label.textContent = 'NO UNIT SELECTED';
    sub.textContent = 'TAP A BANNER OR UNIT TO COMMAND';
  }
  document.querySelectorAll('#mobile-bar [data-action]').forEach(button => {
    button.disabled = !units.length && button.dataset.action !== 'clear';
  });
}

function showToast(title, sub, tone = '#d7bd79') {
  const stack = $('toast-stack');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.style.setProperty('--tone', tone);
  toast.innerHTML = `<b>${title}</b><span>${sub}</span>`;
  stack.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('visible'));
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 420);
  }, 3600);
  while (stack.children.length > 3) stack.firstElementChild.remove();
}

function processNotifications() {
  for (const notice of game.notifications) {
    if (seenNotices.has(notice.id)) continue;
    seenNotices.add(notice.id);
    showToast(notice.title, notice.sub, notice.tone);
  }
}

function switchTeam(teamId) {
  if (!started || game.over) return;
  if (!game.teams[teamId].alive) {
    showToast('EMPIRE HAS FALLEN', `${FACTIONS[teamId].name} no longer has a field army.`, '#b55a4a');
    return;
  }
  if (!game.setActiveTeam(teamId, { focus: true })) return;
  buildRecruitCards();
  lastDossierSignature = '';
  updateDossier(true);
  updateHUD(performance.now(), true);
  audio.init();
  audio.command();
}

function startGame() {
  if (started) return;
  audio.init();
  started = true;
  gameOverShown = false;
  game.start(selectedStartFaction);
  $('start-screen').classList.add('leaving');
  $('hud').classList.remove('hidden');
  setTimeout(() => $('start-screen').classList.add('hidden'), 600);
  buildRecruitCards();
  updateHUD(performance.now(), true);
  updateDossier(true);
  setTimeout(() => {
    showToast('FIVE BANNERS', 'All five empires are yours to command. Switch with 1–5.', '#d7bd79');
  }, 850);
}

function openManual() {
  manualWasPaused = game.paused;
  if (started && game.running && !game.over) game.paused = true;
  $('pause-overlay').classList.add('hidden');
  $('manual-modal').classList.remove('hidden');
  audio.click();
}

function closeManual() {
  $('manual-modal').classList.add('hidden');
  if (started && game.running && !game.over && !manualWasPaused) game.paused = false;
  if (started && game.running && !game.over && manualWasPaused && $('pause-overlay').classList.contains('hidden')) {
    $('pause-overlay').classList.remove('hidden');
  }
  audio.click();
}

function togglePause() {
  if (!started || game.over) return;
  if (!$('manual-modal').classList.contains('hidden')) return;
  game.paused = !game.paused;
  $('pause-overlay').classList.toggle('hidden', !game.paused);
  if (game.paused) audio.click();
}

function restartToMenu() {
  game = new Game(world);
  game.setAudio(audio);
  renderer.game = game;
  started = false;
  gameOverShown = false;
  seenNotices.clear();
  $('gameover-overlay').classList.add('hidden');
  $('pause-overlay').classList.add('hidden');
  $('manual-modal').classList.add('hidden');
  $('hud').classList.add('hidden');
  $('start-screen').classList.remove('hidden', 'leaving');
  $('toast-stack').innerHTML = '';
  buildFactionRail();
  buildRecruitCards();
  updateStartDoctrine();
  updateDossier(true);
  audio.click();
}

function showGameOver() {
  if (gameOverShown || !game.over) return;
  gameOverShown = true;
  const winner = FACTIONS[game.winner];
  const winnerTeam = game.teams[game.winner];
  $('gameover-flag').innerHTML = flagSvg(game.winner);
  $('gameover-kicker')?.remove();
  $('gameover-title').textContent = winner.name;
  $('gameover-text').textContent = game.finishReason === 'armistice'
    ? `${winner.short} has forced an armistice after breaking the enemy line. The maps of Europe are redrawn.`
    : `${winner.short} is the last empire standing. The guns fall silent across the continent.`;
  $('gameover-stats').innerHTML = `
    <div><span>SECTORS</span><b>${game.teamSectorCount(game.winner)} / 15</b></div>
    <div><span>VICTORIES</span><b>${winnerTeam.kills}</b></div>
    <div><span>LOSSES</span><b>${winnerTeam.losses}</b></div>
    <div><span>CAPTURES</span><b>${game.stats.captures}</b></div>`;
  $('gameover-overlay').classList.remove('hidden');
}

function resetViewToTeam() {
  const team = game.activeTeam;
  const sector = game.sectorMap.get(team.spawnSectorId);
  if (sector) {
    game.cameraTarget = { x: sector.x, y: sector.y, zoom: game.camera.zoom };
  }
}

function handleAction(action) {
  audio.init();
  if (action === 'dig') {
    if (game.orderDig()) showToast('DIG IN', 'Selected regiments are preparing cover.', '#d7bd79');
  } else if (action === 'stop') {
    game.orderStop();
  } else if (action === 'hold') {
    game.orderHold();
  } else if (action === 'focus') {
    const units = game.selectedUnits;
    if (units.length) {
      const x = units.reduce((sum, unit) => sum + unit.x, 0) / units.length;
      const y = units.reduce((sum, unit) => sum + unit.y, 0) / units.length;
      game.cameraTarget = { x, y, zoom: Math.max(game.camera.zoom, 1) };
    }
  } else if (action === 'clear') {
    game.clearSelection();
    lastDossierSignature = '';
    updateDossier(true);
    updateMobileBar();
  }
  lastDossierSignature = '';
  updateDossier(true);
  updateMobileBar();
}

function handleDossierClick(event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  if (action === 'deploy') {
    if (game.selectSpawnSector(button.dataset.sector)) {
      showToast('DEPLOYMENT CHANGED', `New regiments will muster at ${game.sectorMap.get(button.dataset.sector).name}.`, FACTIONS[game.activeId].color);
      updateRecruitCards();
    }
  } else if (action === 'focus-sector') {
    const sector = game.sectorMap.get(button.dataset.sector);
    if (sector) game.cameraTarget = { x: sector.x, y: sector.y, zoom: Math.max(game.camera.zoom, 0.9) };
  } else {
    handleAction(action);
  }
}

function handleCanvasClick(clientX, clientY, options = {}) {
  if (!started || game.over) return;
  if (game.paused) return;
  const point = renderer.screenToWorld(clientX, clientY);
  if (game.targeting === 'barrage') {
    game.fireBarrage(point.x, point.y);
    renderer.targetWorld = null;
    updateHUD(performance.now(), true);
    return;
  }

  const hitUnit = game.unitAt(point.x, point.y, true, 19);
  const selectingUnits = game.selectedUnits.length > 0;

  if (hitUnit && hitUnit.teamId === game.activeId) {
    if (options.double && lastClick.unitId === hitUnit.id) {
      const sameType = game.units.filter(unit => !unit.dead && unit.teamId === game.activeId && unit.typeKey === hitUnit.typeKey);
      game.selectUnits(sameType, true);
    } else {
      game.selectUnits([hitUnit], options.additive);
    }
    lastClick = { time: performance.now(), unitId: hitUnit.id };
    lastDossierSignature = '';
    updateDossier(true);
    updateHUD(performance.now(), true);
    audio.click();
    return;
  }

  if (options.touch && selectingUnits) {
    game.orderAt(point.x, point.y);
    lastDossierSignature = '';
    updateDossier(true);
    updateMobileBar();
    return;
  }

  if (hitUnit && hitUnit.teamId !== game.activeId) {
    showToast('ENEMY REGIMENT', `${FACTIONS[hitUnit.teamId].short} unit. Press ${FACTION_ORDER.indexOf(hitUnit.teamId) + 1} to assume command.`, FACTIONS[hitUnit.teamId].color);
    return;
  }

  const sector = game.sectorAt(point.x, point.y, 70);
  if (sector) {
    game.selected.clear();
    game.selectedSectorId = sector.id;
    if (sector.owner === game.activeId) game.selectSpawnSector(sector.id);
    lastDossierSignature = '';
    updateDossier(true);
    updateHUD(performance.now(), true);
    audio.click();
    return;
  }

  game.clearSelection();
  lastDossierSignature = '';
  updateDossier(true);
  updateHUD(performance.now(), true);
}

function setupPointerEvents() {
  canvas.addEventListener('contextmenu', event => event.preventDefault());

  canvas.addEventListener('pointerdown', event => {
    if (!started || game.over) return;
    if (event.pointerType === 'touch') {
      event.preventDefault();
      touch.points.set(event.pointerId, {
        x: event.clientX, y: event.clientY,
        startX: event.clientX, startY: event.clientY
      });
      try { canvas.setPointerCapture(event.pointerId); } catch { /* synthetic or cancelled pointer */ }
      if (touch.points.size === 1) {
        touch.moved = false;
        touch.suppressTap = false;
        touch.lastMid = { x: event.clientX, y: event.clientY };
        touch.lastDistance = 0;
      } else if (touch.points.size === 2) {
        const points = [...touch.points.values()];
        touch.lastMid = { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
        touch.lastDistance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
        touch.moved = true;
      }
      return;
    }
    if (event.button === 2) {
      event.preventDefault();
      if (game.paused) return;
      if (game.targeting === 'barrage') {
        game.cancelTargeting();
        renderer.targetWorld = null;
        updateHUD(performance.now(), true);
        return;
      }
      if (game.selectedUnits.length) {
        const point = renderer.screenToWorld(event.clientX, event.clientY);
        game.orderAt(point.x, point.y);
        lastDossierSignature = '';
        updateDossier(true);
      }
      return;
    }
    if (event.button === 1) {
      event.preventDefault();
      panState = { startX: event.clientX, startY: event.clientY, camX: game.camera.x, camY: game.camera.y, button: 1 };
      try { canvas.setPointerCapture(event.pointerId); } catch { /* synthetic or cancelled pointer */ }
      canvas.classList.add('panning');
      return;
    }
    if (event.button === 0) {
      pointerDown = { startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, moved: false, shift: event.shiftKey };
      try { canvas.setPointerCapture(event.pointerId); } catch { /* synthetic or cancelled pointer */ }
    }
  });

  canvas.addEventListener('pointermove', event => {
    if (!started) return;
    if (event.pointerType === 'touch') {
      if (!touch.points.has(event.pointerId)) return;
      event.preventDefault();
      const point = touch.points.get(event.pointerId);
      point.x = event.clientX;
      point.y = event.clientY;
      const points = [...touch.points.values()];
      if (points.length >= 2) {
        const mid = { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
        const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
        if (touch.lastDistance > 0) {
          const before = renderer.screenToWorld(mid.x, mid.y);
          const zoom = clamp(game.camera.zoom * (distance / touch.lastDistance), 0.43, 1.9);
          game.camera.zoom = zoom;
          const after = renderer.screenToWorld(mid.x, mid.y);
          game.camera.x += before.x - after.x;
          game.camera.y += before.y - after.y;
          game.camera.x -= (mid.x - touch.lastMid.x) / game.camera.zoom;
          game.camera.y -= (mid.y - touch.lastMid.y) / game.camera.zoom;
          game.cameraTarget = null;
          game.clampCamera();
        }
        touch.lastMid = mid;
        touch.lastDistance = distance;
        touch.moved = true;
      } else if (points.length === 1) {
        const dx = event.clientX - point.startX;
        const dy = event.clientY - point.startY;
        if (Math.hypot(dx, dy) > 8) {
          touch.moved = true;
          const moveX = event.clientX - touch.lastMid.x;
          const moveY = event.clientY - touch.lastMid.y;
          game.camera.x -= moveX / game.camera.zoom;
          game.camera.y -= moveY / game.camera.zoom;
          game.cameraTarget = null;
          game.clampCamera();
        }
        touch.lastMid = { x: event.clientX, y: event.clientY };
      }
      return;
    }

    const point = renderer.screenToWorld(event.clientX, event.clientY);
    if (game.targeting === 'barrage') {
      targetPointer = { x: point.x, y: point.y };
      renderer.targetWorld = targetPointer;
    }
    if (game.paused || game.over) return;
    if (panState) {
      game.cameraTarget = null;
      game.camera.x = panState.camX - (event.clientX - panState.startX) / game.camera.zoom;
      game.camera.y = panState.camY - (event.clientY - panState.startY) / game.camera.zoom;
      game.clampCamera();
      return;
    }
    if (pointerDown) {
      pointerDown.x = event.clientX;
      pointerDown.y = event.clientY;
      if (Math.hypot(event.clientX - pointerDown.startX, event.clientY - pointerDown.startY) > 6) {
        pointerDown.moved = true;
        selectionBox = {
          x1: pointerDown.startX,
          y1: pointerDown.startY,
          x2: event.clientX,
          y2: event.clientY
        };
        renderer.selectionBox = selectionBox;
      }
    }
    const hitUnit = game.unitAt(point.x, point.y, true, 19);
    game.hoverUnitId = hitUnit?.id || null;
    const sector = hitUnit ? null : game.sectorAt(point.x, point.y, 70);
    game.hoverSectorId = sector?.id || null;
    canvas.style.cursor = game.targeting === 'barrage' ? 'crosshair' : hitUnit ? 'pointer' : 'default';
  });

  canvas.addEventListener('pointerup', event => {
    if (!started) return;
    if (event.pointerType === 'touch') {
      const wasSingle = touch.points.size === 1;
      const point = touch.points.get(event.pointerId);
      touch.points.delete(event.pointerId);
      if (touch.points.size < 2) touch.lastDistance = 0;
      if (touch.points.size === 0) {
        if (wasSingle && !touch.moved && !touch.suppressTap) {
          handleCanvasClick(event.clientX, event.clientY, { touch: true });
        }
        touch.lastMid = null;
        touch.moved = false;
      } else {
        touch.suppressTap = true;
        const remaining = [...touch.points.values()][0];
        touch.lastMid = { x: remaining.x, y: remaining.y };
      }
      return;
    }
    if (event.button === 1 && panState) {
      panState = null;
      canvas.classList.remove('panning');
      return;
    }
    if (event.button === 0 && pointerDown) {
      const moved = pointerDown.moved;
      const shift = pointerDown.shift;
      pointerDown = null;
      if (moved && selectionBox) {
        const a = renderer.screenToWorld(selectionBox.x1, selectionBox.y1);
        const b = renderer.screenToWorld(selectionBox.x2, selectionBox.y2);
        game.boxSelect(a.x, a.y, b.x, b.y, shift);
        lastDossierSignature = '';
        updateDossier(true);
        updateHUD(performance.now(), true);
        selectionBox = null;
        renderer.selectionBox = null;
        pointerDown = null;
        return;
      }
      selectionBox = null;
      renderer.selectionBox = null;
      handleCanvasClick(event.clientX, event.clientY, { additive: shift });
    }
    pointerDown = null;
  });

  canvas.addEventListener('pointercancel', event => {
    pointerDown = null;
    panState = null;
    selectionBox = null;
    renderer.selectionBox = null;
    touch.points.delete(event.pointerId);
    touch.lastDistance = 0;
    canvas.classList.remove('panning');
  });

  canvas.addEventListener('pointerleave', () => {
    game.hoverUnitId = null;
    game.hoverSectorId = null;
  });

  canvas.addEventListener('wheel', event => {
    if (!started || game.over) return;
    event.preventDefault();
    const before = renderer.screenToWorld(event.clientX, event.clientY);
    const factor = event.deltaY > 0 ? 0.9 : 1.1;
    game.camera.zoom = clamp(game.camera.zoom * factor, 0.43, 1.9);
    const after = renderer.screenToWorld(event.clientX, event.clientY);
    game.camera.x += before.x - after.x;
    game.camera.y += before.y - after.y;
    game.cameraTarget = null;
    game.clampCamera();
  }, { passive: false });

  window.addEventListener('resize', () => {
    renderer.resize(window.innerWidth, window.innerHeight);
    updateHUD(performance.now(), true);
  });

  $('minimap').addEventListener('pointerdown', event => {
    if (!started || game.over) return;
    minimapDragging = true;
    try { $('minimap').setPointerCapture(event.pointerId); } catch { /* synthetic or cancelled pointer */ }
    moveCameraFromMinimap(event);
    event.preventDefault();
  });
  $('minimap').addEventListener('pointermove', event => {
    if (minimapDragging) moveCameraFromMinimap(event);
  });
  $('minimap').addEventListener('pointerup', () => { minimapDragging = false; });
  $('minimap').addEventListener('pointercancel', () => { minimapDragging = false; });
}

function moveCameraFromMinimap(event) {
  const point = renderer.minimapToWorld(event.clientX, event.clientY, $('minimap'));
  game.camera.x = point.x;
  game.camera.y = point.y;
  game.cameraTarget = null;
  game.clampCamera();
}

function setupUIEvents() {
  $('start-factions').addEventListener('click', event => {
    const button = event.target.closest('[data-start-team]');
    if (!button) return;
    selectedStartFaction = button.dataset.startTeam;
    buildStartFactions();
    updateStartDoctrine();
    audio.init();
    audio.click();
  });

  $('start-btn').addEventListener('click', startGame);
  $('manual-btn').addEventListener('click', openManual);
  $('manual-close').addEventListener('click', closeManual);
  $('manual-return').addEventListener('click', closeManual);
  $('pause-btn').addEventListener('click', togglePause);
  $('resume-btn').addEventListener('click', togglePause);
  $('restart-btn').addEventListener('click', restartToMenu);
  $('new-campaign-btn').addEventListener('click', restartToMenu);
  $('pause-manual-btn').addEventListener('click', openManual);
  $('barrage-btn').addEventListener('click', () => {
    if (!started || game.over || game.paused) return;
    audio.init();
    if (game.targeting === 'barrage') {
      game.cancelTargeting();
      renderer.targetWorld = null;
    } else if (game.beginBarrageTargeting()) {
      showToast('FIRE MISSION READY', 'Click the battlefield to designate a barrage target.', '#d7bd79');
    }
    updateHUD(performance.now(), true);
  });
  $('sound-btn').addEventListener('click', () => {
    soundOn = !soundOn;
    audio.setEnabled(soundOn);
    $('sound-icon').textContent = soundOn ? '◈' : '◇';
    $('sound-btn').classList.toggle('muted', !soundOn);
  });

  $('dossier').addEventListener('click', handleDossierClick);
  $('mobile-bar').addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (button) {
      if (button.dataset.action === 'clear') {
        game.clearSelection();
        updateDossier(true);
        updateMobileBar();
      } else {
        handleAction(button.dataset.action);
      }
    }
  });
  $('faction-rail').addEventListener('click', event => {
    const button = event.target.closest('[data-team]');
    if (button) switchTeam(button.dataset.team);
  });
  $('recruit-cards').addEventListener('click', event => {
    const card = event.target.closest('[data-unit]');
    if (!card || card.disabled) return;
    const result = game.recruit(card.dataset.unit);
    if (!result.ok) showToast('REQUISITION DENIED', result.message, '#b96a53');
    else {
      showToast('REGIMENT MUSTERED', result.message, FACTIONS[game.activeId].color);
      updateHUD(performance.now(), true);
    }
    audio.init();
  });
}

function setupKeyboard() {
  window.addEventListener('keydown', event => {
    const manualOpen = !$('manual-modal').classList.contains('hidden');
    const pauseOpen = !$('pause-overlay').classList.contains('hidden');
    const gameOverOpen = !$('gameover-overlay').classList.contains('hidden');
    if (event.key === 'Escape') {
      if (manualOpen) { closeManual(); return; }
      if (gameOverOpen) return;
      if (game.targeting) {
        game.cancelTargeting();
        renderer.targetWorld = null;
        updateHUD(performance.now(), true);
        return;
      }
      if (started && !game.over) togglePause();
      return;
    }
    if (manualOpen || pauseOpen || gameOverOpen) return;
    if (!started && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      startGame();
      return;
    }
    if (!started || game.over) return;
    if (event.key === ' ' || event.key.toLowerCase() === 'p') {
      event.preventDefault();
      togglePause();
      return;
    }
    if (game.paused) return;
    const key = event.key.toLowerCase();
    if (event.key >= '1' && event.key <= '5') {
      const teamId = FACTION_ORDER[Number(event.key) - 1];
      if (teamId) switchTeam(teamId);
      return;
    }
    if (key === 'q') {
      if (game.targeting === 'barrage') {
        game.cancelTargeting();
        renderer.targetWorld = null;
      } else game.beginBarrageTargeting();
      updateHUD(performance.now(), true);
      return;
    }
    if (key === 'h') { handleAction('dig'); return; }
    if (key === 's') { game.orderStop(); updateDossier(true); return; }
    if (key === 'f') { handleAction('focus'); return; }
    if (key === 'm') { $('sound-btn').click(); return; }
    if (UNIT_KEYS[key]) {
      const card = document.querySelector(`[data-unit="${UNIT_KEYS[key]}"]`);
      if (card && !card.disabled) card.click();
      return;
    }
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(key)) {
      // Note: s is claimed by stop, so camera uses WASD only when no shift modifier.
      keys.add(key);
      event.preventDefault();
    }
  });

  window.addEventListener('keyup', event => {
    keys.delete(event.key.toLowerCase());
  });

  window.addEventListener('blur', () => keys.clear());
}

function updateCameraFromKeys(dt) {
  if (!started || game.paused || game.over) return;
  if (!$('manual-modal').classList.contains('hidden')) return;
  if (!$('pause-overlay').classList.contains('hidden')) return;
  let dx = 0;
  let dy = 0;
  if (keys.has('arrowleft')) dx -= 1;
  if (keys.has('arrowright')) dx += 1;
  if (keys.has('arrowup')) dy -= 1;
  if (keys.has('arrowdown')) dy += 1;
  if (keys.has('a')) dx -= 1;
  if (keys.has('d')) dx += 1;
  if (keys.has('w')) dy -= 1;
  // 's' is reserved for Stop, but if it is held with no selection it can pan south.
  if (keys.has('s') && game.selectedUnits.length === 0) dy += 1;
  if (!dx && !dy) return;
  const length = Math.hypot(dx, dy) || 1;
  const speed = 540 * dt / game.camera.zoom;
  game.camera.x += dx / length * speed;
  game.camera.y += dy / length * speed;
  game.cameraTarget = null;
  game.clampCamera();
}

let lastFrame = performance.now();

function loop(now) {
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  updateCameraFromKeys(dt);
  if (game.running && !game.paused && !game.over) {
    game.update(dt);
    processNotifications();
  }
  renderer.render(now);
  if (started) {
    updateHUD(now);
    if (now - lastDossierUpdate > 220) updateDossier();
    if (now - lastMinimapUpdate > 110) {
      renderer.drawMinimap($('minimap'), now);
      lastMinimapUpdate = now;
    }
    if (game.over && !gameOverShown) showGameOver();
  } else if (now - lastMinimapUpdate > 300) {
    renderer.drawMinimap($('minimap'), now);
    lastMinimapUpdate = now;
  }
  if (audio.started && !game.paused) audio.update(dt, 0.8);
  requestAnimationFrame(loop);
}

function boot() {
  initUI();
  setupPointerEvents();
  setupUIEvents();
  setupKeyboard();
  requestAnimationFrame(loop);
  // Let the opening screen settle into its first painted frame.
  requestAnimationFrame(() => document.body.classList.add('ready'));
  window.__greatWar = { get game() { return game; }, renderer, world, get currentGame() { return game; } };
}

boot();
