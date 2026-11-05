// Combat resolution: direct fire, artillery ballistics, damage, death.
import * as THREE from 'three';
import { G } from './state.js';
import { UNIT_DEFS, BUILDING_DEFS } from './config.js';
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
  if (target.isBuilding) {
    return 'hard';
  }
  const def = UNIT_DEFS[target.type];
  return def.kind === 'armor' ? 'hard' : 'soft';
}
export function targetRadius(target) {
  return target.isBuilding ? BUILDING_DEFS[target.type].radius : UNIT_DEFS[target.type].radius;
}
export function entityPosition(e) { return e.group.position; }

export function fireUnit(u, target) {
  const def = UNIT_DEFS[u.type];
  const tPos = target.group.position.clone();
  const muzzle = muzzleWorld(u);
  u.cooldown = def.reload * (0.9 + Math.random() * 0.25);
  u.recoil = 1;
  const aimErr = def.spread * (0.5 + Math.random() * 0.8);
  const impact = tPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * aimErr * 2, 0.6 + Math.random() * 1.2, (Math.random() - 0.5) * aimErr * 2));
  const category = targetCategory(target);
  const dmgMul = category === 'soft' ? def.vsSoft : def.vsHard;
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
      ownerSide: u.side, damage: def.damage, aoe: def.aoe, t: 0,
      sprite: makeShellSprite(from)
    });
    G.timers.push({ t: T * 0.5, fn: () => audio.whistle() });
    return;
  }

  // Direct fire — hitscan visualized by tracer
  spawnTracer(muzzle, impact, u.type === 'rifle' ? 0xffe9a0 : 0xffc06a, 0.09, u.type === 'tank' ? 0.16 : 0.07);
  if (u.type === 'tank') { audio.cannon(); spawnMuzzleFlash(muzzle, 1.9); }
  else if (u.type === 'recon') { audio.reconShot(); spawnMuzzleFlash(muzzle, 0.9); }
  else { audio.rifle(); spawnMuzzleFlash(muzzle, 0.75); }

  if (isHit) {
    applyDamage(target, def.damage * dmgMul, u);
    // Spark on impact
    spawnMuzzleFlash(impact, 0.55);
    audio.hit();
  } else {
    // Dirt puff where the round lands near the target
    spawnMuzzleFlash(impact, 0.4);
  }
}

export function applyDamage(target, amount, attacker) {
  if (!target || target.dead) return;
  target.hp -= amount;
  // Floating damage tick for buildings (bar handled by HUD anyway)
  if (target.hp <= 0) killEntity(target, attacker);
}

export function killEntity(target, attacker) {
  if (target.dead) return;
  target.dead = true;
  const pos = target.group.position.clone();
  if (target.isBuilding) {
    const big = target.type === 'hq';
    spawnExplosion(pos.clone().add(new THREE.Vector3(0, 2, 0)), big ? 3.4 : 2.1, { crater: false });
    audio.explosion(true);
    if (attacker) {
      const s = attacker.side === 'player' ? G.stats.player : G.stats.axis;
      s.buildingsDestroyed++;
    }
    const defSide = target.side;
    const eStats = defSide === 'player' ? G.stats.player : G.stats.axis;
    eStats.buildingsLost++;
    removeEntity(target);
  } else {
    const isArmor = UNIT_DEFS[target.type].kind === 'armor';
    spawnExplosion(pos.clone().add(new THREE.Vector3(0, 0.9, 0)), isArmor ? 2.0 : 0.85, { crater: isArmor });
    if (isArmor) spawnWreck(pos, 2.2);
    audio.explosion(isArmor);
    if (attacker) {
      const s = attacker.side === 'player' ? G.stats.player : G.stats.axis;
      s.kills++;
      attacker.kills = (attacker.kills || 0) + 1;
    }
    const eStats = target.side === 'player' ? G.stats.player : G.stats.axis;
    eStats.unitsLost++;
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
      // Impact!
      if (p.sprite) { G.scene.remove(p.sprite); p.sprite.material.dispose(); }
      const impact = new THREE.Vector3(p.pos.x, groundY, p.pos.z);
      spawnExplosion(impact.clone().add(new THREE.Vector3(0, 0.4, 0)), 1.6, { crater: true });
      audio.explosion(false);
      // Splash damage
      const aoe = p.aoe;
      const attackerRef = { side: p.ownerSide, kills: 0 };
      for (const unit of [...G.units]) {
        const d = unit.group.position.distanceTo(impact);
        if (d < aoe + UNIT_DEFS[unit.type].radius) {
          const falloff = Math.max(0.25, 1 - (d / (aoe + UNIT_DEFS[unit.type].radius)) * 0.75);
          const cat = targetCategory(unit);
          const mul = cat === 'soft' ? 1.55 : 0.62;
          applyDamage(unit, p.damage * mul * falloff, attackerRef);
        }
      }
      for (const b of [...G.buildings]) {
        if (b.buildProgress < 1) { /* still damageable */ }
        const d = b.group.position.distanceTo(impact);
        if (d < aoe + BUILDING_DEFS[b.type].radius) {
          const falloff = Math.max(0.3, 1 - (d / (aoe + BUILDING_DEFS[b.type].radius)) * 0.7);
          applyDamage(b, p.damage * 0.62 * falloff, attackerRef);
        }
      }
      G.projectiles.splice(i, 1);
    }
  }
}
