// Per-frame simulation: units, buildings (incl. armed forts & mines), flags, economy, auras.
import * as THREE from 'three';
import { G, areEnemies, sameTeam, isPlayerControlled } from './state.js';
import { UNIT_DEFS, BUILDING_DEFS, ECONOMY, DIFFICULTY, MAP_SIZE, FACTIONS, FACTION_IDS } from './config.js';
import { terrainHeight } from './world.js';
import { fireUnit, fireFortWeapon, killEntity, damageArea } from './combat.js';
import { getFlagTexture } from './world.js';
import { spawnUnit, buildingExitPos, setMeshOpacity } from './commands.js';
import { spawnSmokePuff, spawnExplosion } from './effects.js';
import { setHealthBar } from './entities.js';
import { feedEvent } from './feed.js';
import { audio } from './audio.js';

const tmpV = new THREE.Vector3();
const dist2D = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

export function nearestEnemy(pos, sight, faction) {
  let best = null, bestScore = Infinity;
  const consider = (e, isBld) => {
    if (e.dead) return;
    const d = dist2D(pos.x, pos.z, e.group.position.x, e.group.position.z);
    if (d > sight) return;
    const score = d + (isBld ? 18 : 0);
    if (score < bestScore) { bestScore = score; best = e; }
  };
  for (const e of G.units) if (areEnemies(faction, e.faction)) consider(e, false);
  for (const e of G.buildings) if (areEnemies(faction, e.faction)) consider(e, true);
  return best;
}

function acquireTarget(u) {
  const sight = UNIT_DEFS[u.type].sight * (u.buff?.sight || 1);
  u.target = nearestEnemy(u.group.position, sight, u.faction);
}

function withinLeash(u) {
  return dist2D(u.group.position.x, u.group.position.z, u.anchor.x, u.anchor.z) < 46;
}

function rotateToward(obj, targetAngle, rate, dt) {
  let diff = targetAngle - obj.rotation.y;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const step = Math.sign(diff) * Math.min(Math.abs(diff), rate * dt);
  obj.rotation.y += step;
}

function moveUnit(u, goal, dt) {
  const def = u.def;
  const p = u.group.position;
  const dx = goal.x - p.x, dz = goal.z - p.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.001) return;
  const turnRate = u.type === 'tank' ? 1.9 : u.type === 'arty' ? 1.5 : 4.2;
  rotateToward(u.group, Math.atan2(dx, dz), turnRate, dt);
  let facing = Math.atan2(dx, dz) - u.group.rotation.y;
  while (facing > Math.PI) facing -= Math.PI * 2;
  while (facing < -Math.PI) facing += Math.PI * 2;
  const alignment = Math.cos(facing);
  const speed = def.speed * (u.buff?.speed || 1) * (alignment > 0 ? Math.max(0.25, alignment) : 0.12);
  p.x += Math.sin(u.group.rotation.y) * speed * dt;
  p.z += Math.cos(u.group.rotation.y) * speed * dt;
  const B = MAP_SIZE / 2 - 6;
  p.x = Math.max(-B, Math.min(B, p.x));
  p.z = Math.max(-B, Math.min(B, p.z));
  p.y = terrainHeight(p.x, p.z);
  u.moving = true;
}

// Recompute aura buffs for one unit.
function rebuildBuffs(u) {
  const buff = { dmg: 1, reload: 1, speed: 1, sight: 1, arty: 1 };
  let heal = 0;
  const p = u.group.position;
  const def = u.def;
  for (const b of G.buildings) {
    if (b.dead || b.buildProgress < 1) continue;
    const bd = b.def;
    // Friendly / allied support auras
    if (bd.aura && sameTeam(b.faction, u.faction)) {
      const d = dist2D(p.x, p.z, b.group.position.x, b.group.position.z);
      if (d <= bd.aura.radius) {
        switch (bd.aura.kind) {
          case 'damage': buff.dmg *= bd.aura.mult; break;
          case 'reload': buff.reload *= bd.aura.mult; break;
          case 'sight': buff.sight *= bd.aura.mult; break;
          case 'artyDamage': buff.arty *= bd.aura.mult; break;
          case 'speed': if (def.kind !== 'infantry') buff.speed *= bd.aura.mult; break;
          case 'healInfantry': if (def.kind === 'infantry') heal = Math.max(heal, bd.aura.rate); break;
          case 'healVehicle': if (def.kind !== 'infantry') heal = Math.max(heal, bd.aura.rate); break;
        }
      }
    }
    // Hostile barbed wire — slows enemy infantry
    if (bd.snare && areEnemies(b.faction, u.faction) && def.kind === 'infantry') {
      const d = dist2D(p.x, p.z, b.group.position.x, b.group.position.z);
      if (d <= bd.snare.radius) buff.speed *= bd.snare.speedMul;
    }
  }
  u.buff = buff;
  u.healRate = heal;
}

export function updateUnits(dt) {
  for (const u of G.units) {
    if (u.dead) continue;
    const def = u.def;
    rebuildBuffs(u);
    if (u.healRate > 0 && u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + u.healRate * dt);
    u.cooldown -= dt;
    u.recoil = Math.max(0, u.recoil - dt * 2.6);
    u.scanT -= dt;
    if (u.scanT <= 0) { u.scanT = 0.35 + Math.random() * 0.25; acquireTarget(u); }
    u.moving = false;

    const p = u.group.position;
    let moveGoal = null;
    let engage = null;
    const order = u.order;

    if (order.kind === 'attack') {
      if (!order.target || order.target.dead) {
        u.order = { kind: 'idle', x: p.x, z: p.z };
        u.anchor = { x: p.x, z: p.z };
      }
    }

    const tgt = u.order.kind === 'attack' ? u.order.target : u.target;
    const tgtValid = tgt && !tgt.dead;

    if (u.order.kind === 'move') {
      if (dist2D(p.x, p.z, u.order.x, u.order.z) < 1.7) {
        u.order = { kind: 'idle', x: p.x, z: p.z };
        u.anchor = { x: p.x, z: p.z };
      } else moveGoal = u.order;
    } else if (u.order.kind === 'attackmove') {
      if (tgtValid) {
        const d = dist2D(p.x, p.z, tgt.group.position.x, tgt.group.position.z);
        if (d <= def.range && d >= (def.minRange || 0)) engage = tgt;
        else if (d <= def.sight + 8) moveGoal = tgt.group.position;
        else moveGoal = u.order;
      } else moveGoal = u.order;
      if (!engage && dist2D(p.x, p.z, u.order.x, u.order.z) < 1.8) {
        u.order = { kind: 'idle', x: p.x, z: p.z };
        u.anchor = { x: p.x, z: p.z };
      }
    } else if (u.order.kind === 'attack') {
      if (tgtValid) {
        const d = dist2D(p.x, p.z, tgt.group.position.x, tgt.group.position.z);
        const minR = def.minRange || 0;
        if (d <= def.range && d >= minR) engage = tgt;
        else if (minR && d < minR) {
          const away = tmpV.set(p.x - tgt.group.position.x, 0, p.z - tgt.group.position.z).normalize();
          moveGoal = { x: p.x + away.x * 14, z: p.z + away.z * 14 };
        } else moveGoal = tgt.group.position;
      }
    } else {
      if (tgtValid) {
        const d = dist2D(p.x, p.z, tgt.group.position.x, tgt.group.position.z);
        const minR = def.minRange || 0;
        if (d <= def.range && d >= minR) engage = tgt;
        else if (u.stance !== 'hold' && d <= def.sight && withinLeash(u)) {
          if (minR && d < minR) {
            const away = tmpV.set(p.x - tgt.group.position.x, 0, p.z - tgt.group.position.z).normalize();
            moveGoal = { x: p.x + away.x * 12, z: p.z + away.z * 12 };
          } else moveGoal = tgt.group.position;
        }
      }
    }

    if (moveGoal) moveUnit(u, moveGoal, dt);

    if (engage) {
      const tp = engage.group.position;
      if (u.type === 'tank' || u.type === 'rifle' || u.type === 'recon' || u.type === 'arty') {
        rotateToward(u.group, Math.atan2(tp.x - p.x, tp.z - p.z), u.type === 'tank' ? 1.6 : 3.4, dt);
      }
      if (u.type === 'tank' && u.group.userData.turret) {
        const worldYaw = u.group.rotation.y;
        const want = Math.atan2(tp.x - p.x, tp.z - p.z) - worldYaw;
        rotateToward(u.group.userData.turret, want, 2.6, dt);
      }
      if (u.cooldown <= 0) fireUnit(u, engage);
    } else if (u.type === 'tank' && u.group.userData.turret) {
      rotateToward(u.group.userData.turret, 0, 1.4, dt);
    }

    if (u.recoil > 0 && u.group.userData.barrel) {
      u.group.userData.barrel.position.z = u.group.userData.barrelBaseZ - u.recoil * 0.42;
    }

    if (u.group.userData.soldiers) {
      const t = G.clockTime;
      for (const s of u.group.userData.soldiers) {
        s.position.y = u.moving ? Math.abs(Math.sin(t * 9 + s.userData.phase)) * 0.16 : Math.sin(t * 1.7 + s.userData.phase) * 0.03;
      }
    }
  }

  // Separation + building collision push-out (vehicle-blocking forts respected too)
  const units = G.units;
  for (let i = 0; i < units.length; i++) {
    const a = units[i]; if (a.dead) continue;
    const pa = a.group.position;
    for (const b of G.buildings) {
      if (b.def.blockVehicles && UNIT_DEFS[a.type].kind === 'infantry') continue;
      const pb = b.group.position;
      const rr = b.def.radius + UNIT_DEFS[a.type].radius * 0.8 + 0.25;
      const dx = pa.x - pb.x, dz = pa.z - pb.z;
      const d = Math.hypot(dx, dz);
      if (d < rr && d > 0.001) {
        const push = (rr - d);
        pa.x += (dx / d) * push; pa.z += (dz / d) * push;
      }
    }
    for (let j = i + 1; j < units.length; j++) {
      const b = units[j]; if (b.dead) continue;
      const pb = b.group.position;
      const rr = UNIT_DEFS[a.type].radius + UNIT_DEFS[b.type].radius + 0.15;
      const dx = pa.x - pb.x, dz = pa.z - pb.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        const push = (rr - d) * 0.5;
        const nx = dx / d, nz = dz / d;
        pa.x += nx * push; pa.z += nz * push;
        pb.x -= nx * push; pb.z -= nz * push;
      }
    }
    pa.y = terrainHeight(pa.x, pa.z);
  }
}

export function updateBuildings(dt) {
  for (const b of [...G.buildings]) {
    const def = b.def;
    // Construction
    if (b.buildProgress < 1) {
      b.buildProgress = Math.min(1, b.buildProgress + dt / def.buildTime);
      const k = b.buildProgress;
      b.group.scale.y = 0.18 + 0.82 * k;
      setMeshOpacity(b.group, 0.45 + 0.55 * k);
      if (b.buildProgress >= 1) {
        b.group.scale.y = 1;
        setMeshOpacity(b.group, 1);
        const mine = def.mine;
        if (mine) b.mineCharges = mine.charges;
        feedEvent(`${def.name} constructed`, b.faction);
        audio.build();
      }
      continue;
    }
    // Armed forts open fire
    if (def.weapon) {
      b.cooldown = (b.cooldown ?? 0.5) - dt;
      b.scanT = (b.scanT ?? 0) - dt;
      if (b.scanT <= 0) {
        b.scanT = 0.4 + Math.random() * 0.25;
        b.target = nearestEnemy(b.group.position, def.weapon.sight, b.faction);
      }
      const t = b.target;
      if (t && !t.dead && b.cooldown <= 0) {
        const d = dist2D(b.group.position.x, b.group.position.z, t.group.position.x, t.group.position.z);
        if (d <= def.weapon.range) fireFortWeapon(b, t);
      } else if (t && t.dead) b.target = null;
    }
    // Minefield — hostile trigger detonation
    if (def.mine && b.mineCharges > 0) {
      b.scanT = (b.scanT ?? 0) - dt;
      if (b.scanT <= 0) {
        b.scanT = 0.22;
        const p = b.group.position;
        const victim = nearestEnemy(p, 3.1, b.faction);
        if (victim) {
          b.mineCharges--;
          damageArea(b.faction, p, def.mine.aoe, def.mine.damage, { softMul: 1.6, hardMul: 0.25 });
          spawnExplosion(new THREE.Vector3(p.x, p.y + 0.4, p.z), 1.15, { crater: true });
          audio.explosion(false);
          if (b.mineCharges <= 0) {
            feedEvent('Minefield expended', b.faction);
            killEntity(b, null);
            continue;
          }
        }
      }
    }
    // Factory smoke
    if (b.type === 'factory') {
      b.smokeT = (b.smokeT || 0) - dt;
      if (b.smokeT <= 0) {
        b.smokeT = 0.5 + Math.random() * 0.4;
        const stacks = b.group.userData.smokestacks || [];
        for (const [sx, sy, sz] of stacks) {
          spawnSmokePuff(new THREE.Vector3(b.group.position.x + sx, b.group.position.y + sy, b.group.position.z + sz));
        }
      }
    }
    // HQ / Radio Mast beacon blink
    if (b.group.userData.beacon) {
      b.group.userData.beacon.material.emissiveIntensity = Math.sin(G.clockTime * 2.6) > 0 ? 1.7 : 0.15;
    }
    // Training queue
    if (def.trains && b.queue.length) {
      const item = b.queue[0];
      item.t -= dt;
      if (item.t <= 0) {
        b.queue.shift();
        const exit = buildingExitPos(b);
        const u = spawnUnit(b.faction, item.type, exit.x, exit.z);
        if (b.rally) { u.order = { kind: 'move', x: b.rally.x, z: b.rally.z }; u.anchor = { ...b.rally }; }
        const stats = G.stats.perFaction[b.faction];
        if (stats) stats.unitsTrained++;
        if (isPlayerControlled(b.faction)) {
          const name = FACTIONS[b.faction].units[item.type];
          feedEvent(`${name} ready`, b.faction);
          audio.build();
        }
      }
    }
  }
}
// Faction lookup helpers live in state.js

export function updateFlags(dt) {
  for (const flag of G.flags) {
    // Presence per faction
    const presence = {};
    for (const u of G.units) {
      if (u.dead) continue;
      if (dist2D(u.group.position.x, u.group.position.z, flag.x, flag.z) < 8.6) {
        presence[u.faction] = (presence[u.faction] || 0) + 1;
      }
    }
    const present = Object.keys(presence);
    flag.contested = present.length > 1;
    for (const f of FACTION_IDS) flag[f + 'Presence'] = presence[f] || 0;

    if (flag.contested) {
      // No progress while contested — ring strobes white
    } else if (present.length === 1) {
      const f = present[0];
      if (flag.owner === f) {
        flag.progress = Math.max(0, flag.progress - dt * 10);
      } else {
        if (flag.capturingFaction !== f) { flag.capturingFaction = f; flag.progress = Math.max(0, flag.progress - dt * 30); }
        flag.progress += dt * (7 + presence[f] * 3.2);
        if (flag.progress >= 100) {
          flag.owner = f;
          flag.progress = 0;
          flag.capturingFaction = null;
          const stats = G.stats.perFaction[f];
          if (stats) stats.flagsCaptured++;
          flag.clothMat.map = getFlagTexture(f);
          flag.clothMat.needsUpdate = true;
          const friendly = isPlayerControlled(f) || (G.alliances[f] && G.alliances[f] === G.alliances[G.playerFaction] && G.alliances[f] !== 'ffa' && !G.sandbox);
          feedEvent(friendly ? `${flag.id} — ${flag.label} secured` : `${flag.id} — ${flag.label} lost`, f);
          audio.capture();
        }
      }
    } else {
      flag.progress = Math.max(0, flag.progress - dt * 6);
    }

    // Ring visuals
    const mat = flag.ringMat;
    if (flag.contested) {
      mat.color.setHex(0xffffff);
      mat.opacity = 0.55 + 0.35 * Math.sin(G.clockTime * 7);
    } else if (flag.owner === 'neutral') {
      mat.color.setHex(0xd8d5c8);
      mat.opacity = 0.45 + 0.15 * Math.sin(G.clockTime * 2.2);
    } else {
      mat.color.setHex(FACTIONS[flag.owner].ring);
      mat.opacity = 0.62;
    }
    // Cloth wave
    const cloth = flag.cloth;
    const pos = cloth.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      pos.setZ(i, Math.sin(x * 2.7 + G.clockTime * 3.6 + flag.x) * 0.1 * (x / 2.2 + 0.15));
    }
    pos.needsUpdate = true;
  }
}
export function updateEconomy(dt) {
  let playerFlags = 0;
  const perFaction = {};
  for (const f of FACTION_IDS) perFaction[f] = 0;
  for (const f of G.flags) {
    if (f.owner !== 'neutral') perFaction[f.owner]++;
  }
  for (const f of FACTION_IDS) if (isPlayerControlled(f)) playerFlags += perFaction[f];
  G.player.income = (G.sandbox ? ECONOMY.sandboxIncome : ECONOMY.baseIncome) + playerFlags * ECONOMY.captureIncome;
  G.player.req = Math.min(9999, G.player.req + G.player.income * dt);
  const diffMul = DIFFICULTY[G.difficulty].aiIncome;
  for (const f of Object.keys(G.aiState)) {
    const income = ECONOMY.baseIncome * diffMul + perFaction[f] * ECONOMY.captureIncome;
    G.aiState[f].req = Math.min(9999, G.aiState[f].req + income * dt);
    G.aiState[f].income = income;
  }
}

export function updateTimers(dt) {
  for (let i = G.timers.length - 1; i >= 0; i--) {
    const t = G.timers[i];
    t.t -= dt;
    if (t.t <= 0) { G.timers.splice(i, 1); try { t.fn(); } catch (e) { /* ignore */ } }
  }
}

export function updateHealthBars() {
  const cam = G.camera;
  const consider = (list) => {
    for (const e of list) {
      if (e.dead) { e.bar.group.visible = false; continue; }
      const mine = isPlayerControlled(e.faction);
      const show = mine
        ? (e.hp < e.maxHp || !e.isBuilding || G.selection.includes(e) || (e.buildProgress !== undefined && e.buildProgress < 1))
        : (e.hp < e.maxHp * 0.999);
      e.bar.group.visible = !!show;
      if (!e.bar.group.visible) continue;
      const p = e.group.position;
      const yOff = e.isBuilding
        ? (e.type === 'hq' ? 11 : e.type === 'factory' ? 10 : Math.min(9, e.def.radius * 1.7 + 1.2))
        : e.def.barY;
      e.bar.group.position.set(p.x, p.y + yOff + 0.4, p.z);
      e.bar.group.quaternion.copy(cam.quaternion);
      if (e.isBuilding && e.buildProgress < 1) {
        setHealthBar(e.bar, e.buildProgress, 0xe0c060);
      } else {
        setHealthBar(e.bar, e.hp / e.maxHp);
      }
    }
  };
  consider(G.units);
  consider(G.buildings);
}
