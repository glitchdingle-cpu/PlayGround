// Combat resolution: direct fire, artillery ballistics, area damage, death.
import * as THREE from 'three';
import { G, areEnemies } from './state.js';
import { UNIT_DEFS, BUILDING_DEFS, FACTIONS } from './config.js';
import { spawnTracer, spawnMuzzleFlash, spawnExplosion, spawnWreck, addCrater } from './effects.js';
import { terrainHeight } from './world.js';
import { audio } from './audio.js';

const V = new THREE.Vector3();
let shellTex = null;
function getShellTex() {
  if (shellTex) return shellTex;
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,240,200,1)');
  g.addColorStop(0.5, 'rgba(255,190,90,0.75)');
  g.addColorStop(1, 'rgba(255,160,60,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 32, 32);
  shellTex = new THREE.CanvasTexture(c);
  return shellTex;
}
function makeShellSprite(pos) {
  const mat = new THREE.SpriteMaterial({ map: getShellTex(), color: 0xffd090, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const sp = new THREE.Sprite(mat);
  sp.position.copy(pos);
  sp.scale.set(1.5, 1.5, 1);
  G.scene.add(sp);
  return sp;
}
function muzzleWorld(u) {
  const grp = u.group;
  const rot = grp.rotation.y;
  const fwd = V.set(Math.sin(rot), 0, Math.cos(rot)).clone();
  const mh = u.type === 'rifle' ? 1.15 : u.type === 'recon' ? 1.5 : u.type === 'tank' ? 1.85 : 2.5;
  const mf = u.type === 'rifle' ? 0.9 : u.type === 'recon' ? 1.45 : u.type === 'tank' ? 3.3 : 0.4;
  return grp.position.clone().addScaledVector(fwd, mf).add(new THREE.Vector3(0, mh, 0));
}

export function targetCategory(target) {
  if (target.isBuilding) return 'hard';
  const def = UNIT_DEFS[target.type];
  return def.kind === 'armor' ? 'hard' : 'soft';
}
export function targetRadius(target) {
  return target.isBuilding ? BUILDING_DEFS[target.type].radius : UNIT_DEFS[target.type].radius;
}
export function entityPosition(e) { return e.group.position; }
const dist2D = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

export function fireUnit(u, target) {
  const def = UNIT_DEFS[u.type];
  const buff = u.buff || {};
  const tPos = target.group.position.clone();
  const muzzle = muzzleWorld(u);
  u.cooldown = def.reload * (buff.reload || 1) * (0.9 + Math.random() * 0.25);
  u.recoil = 1;
  const dmgMul = (buff.dmg || 1) * (u.type === 'arty' ? (buff.arty || 1) : 1);
  const aimErr = def.spread * (0.5 + Math.random() * 0.8);
  const impact = tPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * aimErr * 2, 0.6 + Math.random() * 1.2, (Math.random() - 0.5) * aimErr * 2));
  const category = targetCategory(target);
  const catMul = category === 'soft' ? def.vsSoft : def.vsHard;
  const hitChance = target.isBuilding ? 0.95 : 0.82;
  const isHit = Math.random() < hitChance;

  if (u.type === 'arty') {
    audio.artyFire();
    spawnMuzzleFlash(muzzle, 2.4);
    const from = muzzle;
    const to = tPos.clone(); to.y = terrainHeight(to.x, to.z);
    const dist = from.distanceTo(to);
    const T = Math.min(3.1, Math.max(1.7, 1.35 + dist / 48));
    const g = 30;
    const vel = new THREE.Vector3((to.x - from.x) / T, (g * T) / 2 + (to.y - from.y) / T, (to.z - from.z) / T);
    G.projectiles.push({
      kind: 'shell', pos: from.clone(), vel, gravity: g,
      faction: u.faction, damage: def.damage * dmgMul, aoe: def.aoe, t: 0,
      sprite: makeShellSprite(from)
    });
    G.timers.push({ t: T * 0.5, fn: () => audio.whistle() });
    return;
  }

  spawnTracer(muzzle, impact, u.type === 'rifle' ? 0xffe9a0 : 0xffc06a, 0.09, u.type === 'tank' ? 0.16 : 0.07);
  if (u.type === 'tank') { audio.cannon(); spawnMuzzleFlash(muzzle, 1.9); }
  else if (u.type === 'recon') { audio.reconShot(); spawnMuzzleFlash(muzzle, 0.9); }
  else { audio.rifle(); spawnMuzzleFlash(muzzle, 0.75); }

  if (isHit) {
    applyDamage(target, def.damage * dmgMul * catMul, u);
    spawnMuzzleFlash(impact, 0.55);
    audio.hit();
  } else {
    spawnMuzzleFlash(impact, 0.4);
  }
}

// Fire from an emplaced weapon (fort) — hitscan or plunging shell.
export function fireFortWeapon(b, target) {
  const w = b.def.weapon;
  if (!w || b.dead) return;
  const p = b.group.position;
  const muzzle = new THREE.Vector3(p.x, p.y + (w.kind === 'he' ? 1.9 : 1.15), p.z);
  const tPos = target.group.position.clone();
  b.cooldown = w.reload * (0.9 + Math.random() * 0.25);
  const dmgMul = (b.buffDmg || 1);
  const targetCategory_ = targetCategory(target);
  const catMul = targetCategory_ === 'soft' ? w.vsSoft : w.vsHard;
  const dist = dist2D(p.x, p.z, tPos.x, tPos.z);

  if (w.kind === 'he') {
    audio.artyFire();
    spawnMuzzleFlash(muzzle, 1.6);
    const to = tPos.clone(); to.y = terrainHeight(to.x, to.z);
    const T = Math.min(2.6, Math.max(1.2, 0.9 + dist / 44));
    const g = 30;
    const vel = new THREE.Vector3((to.x - muzzle.x) / T, (g * T) / 2 + (to.y - muzzle.y) / T, (to.z - muzzle.z) / T);
    G.projectiles.push({
      kind: 'shell', pos: muzzle.clone(), vel, gravity: g,
      faction: b.faction, damage: w.damage * dmgMul, aoe: w.aoe || 3.2, t: 0,
      sprite: makeShellSprite(muzzle)
    });
    return;
  }

  // Direct fire
  const aimErr = w.spread * (0.5 + Math.random() * 0.8);
  const impact = tPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * aimErr * 2, 0.5 + Math.random() * 1.1, (Math.random() - 0.5) * aimErr * 2));
  spawnTracer(muzzle, impact, 0xffc06a, 0.09, w.kind === 'ap' ? 0.13 : 0.07);
  spawnMuzzleFlash(muzzle, w.kind === 'ap' ? 1.4 : 0.85);
  if (w.kind === 'ap') audio.cannon(); else audio.rifle();
  if (Math.random() < (target.isBuilding ? 0.95 : 0.8)) {
    applyDamage(target, w.damage * dmgMul * catMul, b);
    spawnMuzzleFlash(impact, 0.5);
    audio.hit();
  } else {
    spawnMuzzleFlash(impact, 0.38);
  }
}

export function applyDamage(target, amount, attacker) {
  if (!target || target.dead) return;
  target.hp -= amount;
  if (target.hp <= 0) killEntity(target, attacker);
}

// Area damage against everything hostile to `attackerFaction`.
export function damageArea(attackerFaction, pos, radius, baseDamage, { softMul = 1.3, hardMul = 0.6 } = {}) {
  const victims = [];
  for (const u of G.units) if (!u.dead && areEnemies(attackerFaction, u.faction)) victims.push(u);
  for (const b of G.buildings) if (!b.dead && areEnemies(attackerFaction, b.faction)) victims.push(b);
  const attackerRef = { faction: attackerFaction };
  for (const v of victims) {
    const d = dist2D(pos.x, pos.z, v.group.position.x, v.group.position.z);
    const reach = radius + targetRadius(v);
    if (d >= reach) continue;
    const falloff = Math.max(0.25, 1 - (d / reach) * 0.72);
    const cat = targetCategory(v);
    const mul = cat === 'soft' ? softMul : hardMul;
    applyDamage(v, baseDamage * mul * falloff, attackerRef);
  }
}

export function killEntity(target, attacker) {
  if (target.dead) return;
  target.dead = true;
  const pos = target.group.position.clone();
  const faction = target.faction;
  if (target.isBuilding) {
    const big = target.type === 'hq';
    spawnExplosion(pos.clone().add(new THREE.Vector3(0, 2, 0)), big ? 3.4 : 2.1, { crater: false });
    audio.explosion(true);
    if (attacker && attacker.faction) {
      const s = G.stats.perFaction[attacker.faction];
      if (s) s.buildingsDestroyed++;
    }
    const eStats = G.stats.perFaction[faction];
    if (eStats) eStats.buildingsLost++;
    // Explosive structures detonate on death
    if (target.def && target.def.explosive) {
      const ex = target.def.explosive;
      spawnExplosion(pos.clone().add(new THREE.Vector3(0, 0.8, 0)), 1.7, { crater: true });
      audio.explosion(false);
      damageArea(faction, pos, ex.aoe, ex.damage, { softMul: 1.35, hardMul: 0.55 });
    }
    removeEntity(target);
  } else {
    const isArmor = UNIT_DEFS[target.type].kind === 'armor';
    spawnExplosion(pos.clone().add(new THREE.Vector3(0, 0.9, 0)), isArmor ? 2.0 : 0.85, { crater: isArmor });
    if (isArmor) spawnWreck(pos, 2.2);
    audio.explosion(isArmor);
    if (attacker && attacker.faction) {
      const s = G.stats.perFaction[attacker.faction];
      if (s) { s.kills++; }
      attacker.kills = (attacker.kills || 0) + 1;
    }
    const eStats = G.stats.perFaction[faction];
    if (eStats) eStats.unitsLost++;
    removeEntity(target);
  }
}

function removeEntity(target) {
  const scene = G.scene;
  scene.remove(target.group);
  target.group.traverse((o) => {
    if (o.isMesh || o.isSprite) {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
        else o.material.dispose();
      }
    }
  });
  if (target.isBuilding) {
    const i = G.buildings.indexOf(target); if (i >= 0) G.buildings.splice(i, 1);
  } else {
    const i = G.units.indexOf(target); if (i >= 0) G.units.splice(i, 1);
  }
  const si = G.selection.indexOf(target); if (si >= 0) G.selection.splice(si, 1);
  G.selectionDirty = true;
}

export function updateProjectiles(dt) {
  for (let i = G.projectiles.length - 1; i >= 0; i--) {
    const p = G.projectiles[i];
    p.t += dt;
    p.vel.y -= p.gravity * dt;
    p.pos.addScaledVector(p.vel, dt);
    if (p.sprite) p.sprite.position.copy(p.pos);
    const groundY = terrainHeight(p.pos.x, p.pos.z);
    if (p.pos.y <= groundY + 0.15) {
      if (p.sprite) { G.scene.remove(p.sprite); p.sprite.material.dispose(); }
      const impact = new THREE.Vector3(p.pos.x, groundY, p.pos.z);
      spawnExplosion(impact.clone().add(new THREE.Vector3(0, 0.4, 0)), 1.6, { crater: true });
      audio.explosion(false);
      damageArea(p.faction, impact, p.aoe, p.damage, { softMul: 1.55, hardMul: 0.62 });
      G.projectiles.splice(i, 1);
    }
  }
}
