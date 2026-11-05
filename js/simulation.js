// Per-frame simulation: units, buildings, flags, economy, timers.
import * as THREE from 'three';
import { G } from './state.js';
import { UNIT_DEFS, BUILDING_DEFS, ECONOMY, DIFFICULTY, MAP_SIZE } from './config.js';
import { terrainHeight } from './world.js';
import { fireUnit } from './combat.js';
import { spawnUnit, buildingExitPos, setMeshOpacity } from './commands.js';
import { spawnSmokePuff } from './effects.js';
import { setHealthBar } from './entities.js';
import { feedEvent } from './feed.js';
import { audio } from './audio.js';

const tmpV = new THREE.Vector3();
const dist2D = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

function acquireTarget(u) {
  let best = null, bestScore = Infinity;
  const p = u.group.position;
  const consider = (e, isBld) => {
    if (e.dead) return;
    const d = dist2D(p.x, p.z, e.group.position.x, e.group.position.z);
    const sight = UNIT_DEFS[u.type].sight;
    if (d > sight) return;
    const score = d + (isBld ? 18 : 0);
    if (score < bestScore) { bestScore = score; best = e; }
  };
  for (const e of G.units) if (e.side !== u.side) consider(e, false);
  for (const e of G.buildings) if (e.side !== u.side) consider(e, true);
  u.target = best;
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
  // Only advance if roughly facing the goal (tracked vehicles need to turn first)
  let facing = Math.atan2(dx, dz) - u.group.rotation.y;
  while (facing > Math.PI) facing -= Math.PI * 2;
  while (facing < -Math.PI) facing += Math.PI * 2;
  const alignment = Math.cos(facing);
  const speed = def.speed * (alignment > 0 ? Math.max(0.25, alignment) : 0.12);
  p.x += Math.sin(u.group.rotation.y) * speed * dt;
  p.z += Math.cos(u.group.rotation.y) * speed * dt;
  // Clamp to bounds
  const B = MAP_SIZE / 2 - 6;
  p.x = Math.max(-B, Math.min(B, p.x));
  p.z = Math.max(-B, Math.min(B, p.z));
  p.y = terrainHeight(p.x, p.z);
  u.moving = true;
}

export function updateUnits(dt) {
  // Acquire + act
  for (const u of G.units) {
    if (u.dead) continue;
    const def = u.def;
    u.cooldown -= dt;
    u.recoil = Math.max(0, u.recoil - dt * 2.6);
    u.scanT -= dt;
    if (u.scanT <= 0) { u.scanT = 0.35 + Math.random() * 0.25; acquireTarget(u); }
    u.moving = false;

    const p = u.group.position;
    let moveGoal = null;
    let engage = null;
    const order = u.order;

    // Resolve stale attack orders
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
          // Too close — back off to restore firing solution
          const away = tmpV.set(p.x - tgt.group.position.x, 0, p.z - tgt.group.position.z).normalize();
          moveGoal = { x: p.x + away.x * 14, z: p.z + away.z * 14 };
        } else moveGoal = tgt.group.position;
      }
    } else {
      // Idle / hold — fire on anything in range, chase within leash unless holding
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

    // Face the gun onto the quarry
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

    // Recoil animation on the barrel
    if (u.recoil > 0 && u.group.userData.barrel) {
      u.group.userData.barrel.position.z = u.group.userData.barrelBaseZ - u.recoil * 0.42;
    }

    // Infantry / crew walk bob
    if (u.group.userData.soldiers) {
      const t = G.clockTime;
      for (const s of u.group.userData.soldiers) {
        s.position.y = u.moving ? Math.abs(Math.sin(t * 9 + s.userData.phase)) * 0.16 : Math.sin(t * 1.7 + s.userData.phase) * 0.03;
      }
    }
  }

  // Separation + building collision push-out
  const units = G.units;
  for (let i = 0; i < units.length; i++) {
    const a = units[i]; if (a.dead) continue;
    const pa = a.group.position;
    // Push out of buildings (all, including under construction)
    for (const b of G.buildings) {
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
    // Re-seat on terrain after pushes
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
        feedEvent(`${def.name} constructed`, b.side === 'player' ? 'player' : 'axis');
        audio.build();
      }
    }
    // Factory smoke
    if (b.type === 'factory' && b.buildProgress >= 1) {
      b.smokeT = (b.smokeT || 0) - dt;
      if (b.smokeT <= 0) {
        b.smokeT = 0.5 + Math.random() * 0.4;
        const stacks = b.group.userData.smokestacks || [];
        for (const [sx, sy, sz] of stacks) {
          spawnSmokePuff(new THREE.Vector3(b.group.position.x + sx, b.group.position.y + sy, b.group.position.z + sz));
        }
      }
    }
    // HQ beacon blink
    if (b.type === 'hq' && b.group.userData.beacon) {
      b.group.userData.beacon.material.emissiveIntensity = Math.sin(G.clockTime * 2.6) > 0 ? 1.7 : 0.15;
    }
    // Training queue
    if (b.buildProgress >= 1 && b.queue.length) {
      const item = b.queue[0];
      item.t -= dt;
      if (item.t <= 0) {
        b.queue.shift();
        const exit = buildingExitPos(b);
        const u = spawnUnit(b.side, item.type, exit.x, exit.z);
        if (b.rally) { u.order = { kind: 'move', x: b.rally.x, z: b.rally.z }; u.anchor = { ...b.rally }; }
        const stats = b.side === 'player' ? G.stats.player : G.stats.axis;
        stats.unitsTrained++;
        if (b.side === 'player') {
          const name = (b.side === 'player' ? { rifle: 'Rifle Squad', recon: 'Recon Jeep', tank: 'M4 Sherman', arty: 'M2 105mm Howitzer' } : {})[item.type];
          feedEvent(`${name || 'Unit'} ready`, 'player');
          audio.build();
        }
      }
    }
  }
}

export function updateFlags(dt) {
  for (const flag of G.flags) {
    let p = 0, a = 0;
    for (const u of G.units) {
      if (u.dead) continue;
      if (dist2D(u.group.position.x, u.group.position.z, flag.x, flag.z) < 8.6) {
        u.side === 'player' ? p++ : a++;
      }
    }
    flag.contested = p > 0 && a > 0;
    flag.playerPresence = p; flag.axisPresence = a;

    let side = null, power = 0;
    if (!flag.contested) {
      if (p > 0) { side = 'player'; power = p; } else if (a > 0) { side = 'axis'; power = a; }
    }
    if (!side) {
      flag.progress = Math.max(0, flag.progress - dt * 6);
    } else if (flag.owner === side) {
      flag.progress = Math.max(0, flag.progress - dt * 10);
    } else {
      if (flag.capturingSide !== side) { flag.capturingSide = side; flag.progress = Math.max(0, flag.progress - dt * 30); }
      flag.progress += dt * (7 + power * 3.2);
      if (flag.progress >= 100) {
        flag.owner = side;
        flag.progress = 0;
        flag.capturingSide = null;
        const stats = side === 'player' ? G.stats.player : G.stats.axis;
        stats.flagsCaptured++;
        flag.clothMat.map = flag.flagTextures[side];
        flag.clothMat.needsUpdate = true;
        feedEvent(side === 'player' ? `${flag.id} — ${flag.label} secured` : `${flag.id} — ${flag.label} lost to the enemy`, side);
        audio.capture();
      }
    }
    // Ring visuals
    const mat = flag.ringMat;
    if (flag.contested) {
      mat.color.setHex(0xffffff);
      mat.opacity = 0.55 + 0.35 * Math.sin(G.clockTime * 7);
    } else if (flag.owner === 'player') { mat.color.setHex(0x8be06a); mat.opacity = 0.6; }
    else if (flag.owner === 'axis') { mat.color.setHex(0xff6a4a); mat.opacity = 0.6; }
    else { mat.color.setHex(0xd8d5c8); mat.opacity = 0.45 + 0.15 * Math.sin(G.clockTime * 2.2); }
    // Cloth wave
    const cloth = flag.cloth;
    const pos = cloth.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      pos.setZ(i, Math.sin(x * 2.7 + G.clockTime * 3.6 + flag.x) * 0.1 * (x / 2.1 + 0.15));
    }
    pos.needsUpdate = true;
  }
}

export function updateEconomy(dt) {
  let pCount = 0, aCount = 0;
  for (const f of G.flags) { if (f.owner === 'player') pCount++; else if (f.owner === 'axis') aCount++; }
  G.player.income = ECONOMY.baseIncome + pCount * ECONOMY.captureIncome;
  G.axis.income = (ECONOMY.baseIncome + aCount * ECONOMY.captureIncome) * DIFFICULTY[G.difficulty].aiIncome;
  G.player.req = Math.min(9999, G.player.req + G.player.income * dt);
  G.axis.req = Math.min(9999, G.axis.req + G.axis.income * dt);
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
  const consider = (list, alwaysOwn) => {
    for (const e of list) {
      if (e.dead) { e.bar.group.visible = false; continue; }
      const show = e.side === 'player'
        ? (e.hp < e.maxHp || !e.isBuilding || G.selection.includes(e) || e.buildProgress < 1)
        : (e.hp < e.maxHp * 0.999);
      e.bar.group.visible = !!show;
      if (!e.bar.group.visible) continue;
      const p = e.group.position;
      const yOff = e.isBuilding ? (e.type === 'hq' ? 11 : e.type === 'factory' ? 10 : 5.4) : e.def.barY;
      e.bar.group.position.set(p.x, p.y + yOff + 0.4, p.z);
      e.bar.group.quaternion.copy(cam.quaternion);
      if (e.isBuilding && e.buildProgress < 1) {
        setHealthBar(e.bar, e.buildProgress, 0xe0c060);
      } else {
        setHealthBar(e.bar, e.hp / e.maxHp);
      }
    }
  };
  consider(G.units, true);
  consider(G.buildings, true);
}
