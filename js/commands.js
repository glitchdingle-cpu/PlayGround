// Shared spawning + ordering helpers used by the player UI, the sandbox and the AI.
import * as THREE from 'three';
import { G, isPlayerControlled } from './state.js';
import { UNIT_DEFS, BUILDING_DEFS, DIFFICULTY, FACTIONS } from './config.js';
import { makeUnitMesh, makeBuildingMesh, makeHealthBar } from './entities.js';
import { terrainHeight } from './world.js';

// Spend from whichever pool owns the faction (player shared pool or per-AI-faction pool).
export function trySpend(faction, cost) {
  if (isPlayerControlled(faction)) {
    if (G.player.req >= cost) { G.player.req -= cost; return true; }
    return false;
  }
  const ai = G.aiState[faction];
  if (ai && ai.req >= cost) { ai.req -= cost; return true; }
  return false;
}

export function spawnUnit(faction, type, x, z) {
  const def = UNIT_DEFS[type];
  const mesh = makeUnitMesh(faction, type);
  const y = terrainHeight(x, z);
  mesh.position.set(x, y, z);
  mesh.rotation.y = Math.atan2(-x, -z) + (faction === 'usa' ? 0 : Math.PI * 0.6);
  G.scene.add(mesh);
  const isAI = !isPlayerControlled(faction);
  const hpMul = isAI ? DIFFICULTY[G.difficulty].hpMul : 1;
  const unit = {
    id: G.nextId++, isBuilding: false, faction, type, def,
    group: mesh, hp: def.hp * hpMul, maxHp: def.hp * hpMul,
    cooldown: 0.4 + Math.random() * 0.6, recoil: 0, scanT: Math.random() * 0.3,
    order: { kind: 'idle', x, z }, anchor: { x, z },
    stance: 'fire', target: null, dead: false, kills: 0,
    buff: null, healRate: 0,
    bar: makeHealthBar(2.3, 0.3)
  };
  unit.bar.group.position.set(x, y + def.barY, z);
  G.scene.add(unit.bar.group);
  mesh.traverse((o) => { o.userData.entityId = unit.id; });
  G.units.push(unit);
  return unit;
}

export function spawnBuilding(faction, type, x, z, instant = false) {
  const def = BUILDING_DEFS[type];
  const mesh = makeBuildingMesh(faction, type);
  const y = terrainHeight(x, z);
  mesh.position.set(x, y, z);
  G.scene.add(mesh);
  const building = {
    id: G.nextId++, isBuilding: true, faction, type, def,
    group: mesh, hp: def.hp, maxHp: def.hp,
    buildProgress: instant ? 1 : 0, queue: [], rally: null,
    dead: false,
    cooldown: 0.5, scanT: Math.random() * 0.3, target: null,
    mineCharges: def.mine ? def.mine.charges : 0,
    bar: makeHealthBar(Math.max(2.6, def.radius * 1.25), 0.42)
  };
  building.bar.group.position.set(x, y + Math.min(10.5, def.radius * 1.7 + 1.2) + 0.4, z);
  G.scene.add(building.bar.group);
  mesh.traverse((o) => { o.userData.entityId = building.id; });
  if (!instant) {
    mesh.scale.y = 0.18;
    setMeshOpacity(mesh, 0.45);
  }
  const cx = -x, cz = -z, len = Math.hypot(cx, cz) || 1;
  building.rally = { x: x + (cx / len) * (def.radius + 7), z: z + (cz / len) * (def.radius + 7) };
  G.buildings.push(building);
  return building;
}

export function setMeshOpacity(root, opacity) {
  root.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      m.transparent = opacity < 1;
      m.opacity = opacity;
      m.depthWrite = opacity >= 1;
    }
  });
}

export function buildingExitPos(b) {
  const dir = new THREE.Vector3(-b.group.position.x, 0, -b.group.position.z).normalize();
  const d = b.def.radius + 2.2;
  return { x: b.group.position.x + dir.x * d + (Math.random() - 0.5) * 2, z: b.group.position.z + dir.z * d + (Math.random() - 0.5) * 2 };
}

export function findEntityById(id) {
  for (const u of G.units) if (u.id === id) return u;
  for (const b of G.buildings) if (b.id === id) return b;
  return null;
}
