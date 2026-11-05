// Mesh factories for units and buildings + shared health bar widget.
import * as THREE from 'three';
import { FACTIONS, BUILDING_DEFS, BUILD_DEFS } from './config.js';
import { terrainHeight, getFlagTexture } from './world.js';

const decalCache = {};
const DECAL_LABELS = { usa: 'star', ussr: 'soviet', germany: 'cross', japan: 'sun', france: 'lorraine' };
function decalTexture(faction) {
  if (decalCache[faction]) return decalCache[faction];
  const kind = DECAL_LABELS[faction] || 'star';
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 128, 128);
  if (kind === 'star') {
    ctx.fillStyle = '#ece8d8';
    ctx.strokeStyle = 'rgba(20,20,16,0.9)'; ctx.lineWidth = 6;
    ctx.beginPath();
    const cx = 64, cy = 64, R = 46, r = 19;
    for (let i = 0; i < 10; i++) {
      const ang = -Math.PI / 2 + (i * Math.PI) / 5, rad = i % 2 === 0 ? R : r;
      const x = cx + Math.cos(ang) * rad, y = cy + Math.sin(ang) * rad;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (kind === 'soviet') {
    ctx.fillStyle = '#d8c25a';
    ctx.beginPath();
    const cx = 64, cy = 60, R = 46, r = 19;
    for (let i = 0; i < 10; i++) {
      const ang = -Math.PI / 2 + (i * Math.PI) / 5, rad = i % 2 === 0 ? R : r;
      const x = cx + Math.cos(ang) * rad, y = cy + Math.sin(ang) * rad;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#d8c25a'; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.arc(64, 78, 30, Math.PI * 0.2, Math.PI * 1.2); ctx.stroke();
  } else if (kind === 'cross') {
    ctx.fillStyle = '#141414';
    ctx.strokeStyle = '#e6e3d8'; ctx.lineWidth = 10;
    ctx.fillRect(44, 8, 40, 112); ctx.fillRect(8, 44, 112, 40);
    ctx.strokeRect(44, 8, 40, 112); ctx.strokeRect(8, 44, 112, 40);
  } else if (kind === 'sun') {
    ctx.fillStyle = '#bc002d';
    ctx.beginPath(); ctx.arc(64, 64, 48, 0, Math.PI * 2); ctx.fill();
  } else if (kind === 'lorraine') {
    ctx.fillStyle = '#e6e3d8';
    ctx.fillRect(56, 6, 16, 116);
    ctx.fillRect(26, 32, 76, 14);
    ctx.fillRect(16, 76, 96, 16);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  decalCache[faction] = tex;
  return tex;
}

export function makeDecal(side, size = 1.15) {
  const mat = new THREE.MeshBasicMaterial({ map: decalTexture(side), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
  return new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
}

function std(color, opts = {}) {
  return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.72, metalness: 0.28 }, opts));
}
function lam(color, opts = {}) {
  return new THREE.MeshLambertMaterial(Object.assign({ color }, opts));
}

// ---------- Units ----------
export function makeUnitMesh(side, type) {
  const F = FACTIONS[side];
  const g = new THREE.Group();
  g.userData.soldiers = [];
  g.userData.wheels = [];

  if (type === 'rifle') {
    const uniformByFaction = { usa: 0x474d2c, ussr: 0x5a4030, germany: 0x4a5058, japan: 0x5a4f2e, france: 0x3f4c66 };
    const helmetByFaction = { usa: 0x3d4226, ussr: 0x453021, germany: 0x3c434c, japan: 0x463d22, france: 0x2f3a52 };
    const uniform = uniformByFaction[side] || 0x474d2c;
    const helmet = helmetByFaction[side] || 0x3d4226;
    const skin = 0x8a6a4f;
    const offsets = [[0, 1.05], [-0.85, 0.15], [0.85, 0.15], [-1.62, -0.95], [1.62, -0.95]];
    offsets.forEach(([ox, oz], i) => {
      const s = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.32, 0.82, 6), lam(uniform));
      body.position.y = 0.72; s.add(body);
      const pack = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.2), lam(0x35301f));
      pack.position.set(0, 0.85, -0.27); s.add(pack);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 8, 6), lam(skin));
      head.position.y = 1.26; s.add(head);
      const helm = new THREE.Mesh(new THREE.SphereGeometry(0.235, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.55), lam(helmet));
      helm.position.y = 1.3; s.add(helm);
      const rifle = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 1.25), lam(0x2b241a));
      rifle.position.set(0.28, 0.95, 0.12); rifle.rotation.x = -0.35; s.add(rifle);
      s.position.set(ox, 0, oz);
      s.userData.phase = i * 1.7;
      s.userData.baseY = 0;
      g.add(s);
      g.userData.soldiers.push(s);
    });
    g.userData.muzzleHeight = 1.1;
    g.userData.muzzleForward = 0.9;
  }

  else if (type === 'recon') {
    const body = std(F.color, { roughness: 0.6, metalness: 0.3 });
    const dark = lam(F.track);
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.6, 3.15), body);
    chassis.position.y = 0.82; g.add(chassis);
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.4, 1.15), body);
    hood.position.set(0, 1.22, 0.98); g.add(hood);
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.52, 0.09), std(0x1c2226, { roughness: 0.15, metalness: 0.85 }));
    windshield.position.set(0, 1.52, 0.38); windshield.rotation.x = 0.28; g.add(windshield);
    const tub = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.34, 1.35), lam(F.dark));
    tub.position.set(0, 1.28, -0.78); g.add(tub);
    // Driver silhouette
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.23, 0.42, 6), lam(F.color));
    torso.position.set(-0.35, 1.55, -0.62); g.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.155, 8, 6), lam(0x8a6a4f));
    head.position.set(-0.35, 1.86, -0.62); g.add(head);
    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
    [[-0.88, 1.02], [0.88, 1.02], [-0.88, -1.02], [0.88, -1.02]].forEach(([wx, wz]) => {
      const w = new THREE.Mesh(wheelGeo, dark);
      w.rotation.z = Math.PI / 2;
      w.position.set(wx, 0.36, wz);
      g.add(w); g.userData.wheels.push(w);
    });
    const spare = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.18, 10), dark);
    spare.rotation.x = Math.PI / 2; spare.position.set(0, 1.05, -1.62); g.add(spare);
    // Headlights
    const lightMat = new THREE.MeshStandardMaterial({ color: 0xd8d2b0, emissive: 0xa49a6a, emissiveIntensity: 0.7 });
    [-0.55, 0.55].forEach((lx) => {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.06), lightMat);
      hl.position.set(lx, 1.22, 1.56); g.add(hl);
    });
    const decal = makeDecal(side, 0.58); decal.position.set(0, 1.06, 1.585); g.add(decal);
    g.userData.muzzleHeight = 1.45;
    g.userData.muzzleForward = 1.45;
  }

  else if (type === 'tank') {
    const body = std(F.color, { roughness: 0.5, metalness: 0.42 });
    const dark = lam(F.track);
    // Tracks
    [-1.14, 1.14].forEach((tx) => {
      const track = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.66, 5.15), dark);
      track.position.set(tx, 0.45, 0); g.add(track);
      const shroud = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.16, 5.2), body);
      shroud.position.set(tx, 0.82, 0); g.add(shroud);
    });
    // Hull
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.6, 4.35), body);
    hull.position.y = 0.98; g.add(hull);
    const glacis = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.55, 1.15), body);
    glacis.position.set(0, 1.02, 2.42); glacis.rotation.x = 0.42; g.add(glacis);
    const engineDeck = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.18, 1.5), lam(F.dark));
    engineDeck.position.set(0, 1.32, -1.28); g.add(engineDeck);
    // Turret (rotates toward target)
    const turret = new THREE.Group();
    turret.position.set(0, 1.52, 0.25);
    const turretBody = new THREE.Mesh(new THREE.CylinderGeometry(0.88, 1.02, 0.6, 10), body);
    turretBody.position.y = 0.28; turret.add(turretBody);
    const turretRoof = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.88, 0.16, 10), body);
    turretRoof.position.y = 0.62; turret.add(turretRoof);
    const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.1, 10), lam(F.dark));
    hatch.position.set(0.32, 0.73, -0.15); turret.add(hatch);
    // Commander silhouette
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.3, 6), lam(F.dark));
    torso.position.set(-0.28, 0.78, -0.1); turret.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), lam(0x8a6a4f));
    head.position.set(-0.28, 1.0, -0.1); turret.add(head);
    // Gun barrel
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 2.75, 7), std(0x2f3326, { roughness: 0.4, metalness: 0.6 }));
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.3, 1.75);
    turret.add(barrel);
    const brake = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.32, 7), std(0x22251c, { roughness: 0.4, metalness: 0.6 }));
    brake.rotation.x = Math.PI / 2;
    brake.position.set(0, 0.3, 3.05);
    turret.add(brake);
    g.add(turret);
    g.userData.turret = turret;
    g.userData.barrel = barrel;
    g.userData.barrelBaseZ = barrel.position.z;
    // Decals on turret sides
    [-1, 1].forEach((s) => {
      const d = makeDecal(side, 0.72);
      d.position.set(s * 0.99, 0.28, 0);
      d.rotation.y = s * Math.PI / 2;
      turret.add(d);
    });
    g.userData.muzzleHeight = 1.82;
    g.userData.muzzleForward = 3.3;
  }

  else if (type === 'arty') {
    const body = std(F.color, { roughness: 0.62, metalness: 0.3 });
    const dark = lam(F.track);
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 3.3), body);
    hull.position.y = 0.78; g.add(hull);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 1.0), body);
    cab.position.set(0, 1.22, 1.05); g.add(cab);
    const shield = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.85, 0.14), body);
    shield.position.set(0, 1.35, -0.35); shield.rotation.x = -0.18; g.add(shield);
    const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.32, 10);
    [[-0.92, 1.05], [0.92, 1.05], [-0.92, -1.0], [0.92, -1.0]].forEach(([wx, wz]) => {
      const w = new THREE.Mesh(wheelGeo, dark);
      w.rotation.z = Math.PI / 2;
      w.position.set(wx, 0.4, wz);
      g.add(w); g.userData.wheels.push(w);
    });
    // Elevated gun
    const gun = new THREE.Group();
    gun.position.set(0, 1.35, -0.45);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 3.5, 7), std(0x2f3326, { roughness: 0.4, metalness: 0.6 }));
    barrel.rotation.x = Math.PI / 2 - 0.62;
    barrel.position.set(0, 0.92, -1.15);
    gun.add(barrel);
    const breech = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.8), lam(F.dark));
    breech.position.set(0, 0.16, 0.15); gun.add(breech);
    g.add(gun);
    g.userData.gun = gun;
    // Split trails
    [-0.5, 0.5].forEach((s) => {
      const trail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 2.3), lam(F.dark));
      trail.position.set(s, 0.42, -1.95); trail.rotation.y = s * 0.36; g.add(trail);
    });
    // Crew
    [[-1.35, -0.15], [1.3, 0.4]].forEach(([ox, oz], i) => {
      const s = new THREE.Group();
      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.26, 0.66, 6), lam({ usa: 0x474d2c, ussr: 0x5a4030, germany: 0x4a5058, japan: 0x5a4f2e, france: 0x3f4c66 }[side] || 0x474d2c));
      torso.position.y = 0.6; s.add(torso);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), lam(0x8a6a4f));
      head.position.y = 1.02; s.add(head);
      s.position.set(ox, 0, oz);
      s.userData.phase = i * 2.3;
      g.add(s); g.userData.soldiers.push(s);
    });
    g.userData.muzzleHeight = 2.5;
    g.userData.muzzleForward = -1.6;
  }

  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  g.userData.type = type;
  return g;
}

// ---------- Fortification builders (shared materials) ----------
const bagMatA = lam(0x57503c);
const bagMatB = lam(0x4c4634);
const crateMatF = lam(0x4f4429);
const crateLidMat = lam(0x2e2820);
const timberMat = lam(0x453823);
const steelDarkMat = lam(0x35352f);
const rustMat = lam(0x5a4436);
const fuelBarrelMat = lam(0x6a2e1e);
const drumMat = lam(0x3a3f34);
const concreteMatF = lam(0x75746c);
const concreteDarkF = lam(0x5a5952);
const stoneMat = lam(0x6a6860);
const canvasOlive = lam(0x6b6244);
const canvasKhaki = lam(0x6f6650);
const canvasWhite = lam(0xd3d0c2);
const tireMat = lam(0x1f1f1c);
const earthDark = lam(0x2c241a);

function addBag(g, x, y, z, s = 1, ry = 0) {
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.5 * s, 7, 5), ((x * 7 + z * 13 + y * 5) | 0) % 2 ? bagMatA : bagMatB);
  b.scale.set(1.2 * s, 0.62 * s, 0.8 * s);
  b.position.set(x, y, z);
  b.rotation.y = ry;
  g.add(b);
}
function addBarrel(g, x, y, z, mat = drumMat, s = 1) {
  const b = new THREE.Mesh(new THREE.CylinderGeometry(0.36 * s, 0.36 * s, 0.95 * s, 9), mat);
  b.position.set(x, y, z);
  g.add(b);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.36 * s, 0.045 * s, 5, 10), steelDarkMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.set(x, y + 0.32 * s, z);
  g.add(rim);
}
function addCrate(g, x, y, z, s = 1, ry = 0) {
  const c = new THREE.Mesh(new THREE.BoxGeometry(0.95 * s, 0.72 * s, 0.95 * s), crateMatF);
  c.position.set(x, y, z);
  c.rotation.y = ry;
  g.add(c);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.99 * s, 0.09 * s, 0.3 * s), crateLidMat);
  lid.position.set(x, y + 0.34 * s, z);
  lid.rotation.y = ry;
  g.add(lid);
}
function addLog(g, x, y, z, len, r, axis = 'x', ry = 0) {
  const log = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 7), timberMat);
  if (axis === 'x') log.rotation.z = Math.PI / 2;
  else if (axis === 'z') log.rotation.x = Math.PI / 2;
  else if (axis === 'y') { /* standing */ }
  log.rotation.y = ry;
  log.position.set(x, y, z);
  g.add(log);
}
function addPost(g, x, z, h, r = 0.09) {
  const p = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.2, h, 6), timberMat);
  p.position.set(x, h / 2, z);
  g.add(p);
}
// Sandbag arc facing +Z (open toward -Z is the enemy approach; bags shield the back)
function bagArc(g, n, radius, bagY, s = 1, arc = Math.PI * 0.9, ryOffset = 0) {
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const a = ryOffset - arc / 2 + t * arc;
    addBag(g, Math.sin(a) * radius, bagY, -Math.cos(a) * radius, s, a + Math.PI / 2);
  }
}
function darkPatch(g, radius, y = 0.03) {
  const geo = new THREE.CircleGeometry(radius, 12);
  geo.rotateX(-Math.PI / 2);
  const p = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x241f16, transparent: true, opacity: 0.65, depthWrite: false }));
  p.position.y = y;
  g.add(p);
}
let netTex = null;
function getNetTexture() {
  if (netTex) return netTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#39412e'; ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = '#232a1c'; ctx.lineWidth = 5;
  for (let i = -128; i < 256; i += 16) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 128, 128); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(i + 128, 0); ctx.lineTo(i, 128); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(74,88,56,0.7)';
  for (let i = 0; i < 40; i++) ctx.fillRect(Math.random() * 128, Math.random() * 128, 8, 5);
  netTex = new THREE.CanvasTexture(c);
  netTex.colorSpace = THREE.SRGBColorSpace;
  return netTex;
}
let mineSignTex = null;
function getMineSignTexture() {
  if (mineSignTex) return mineSignTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#d8c25a'; ctx.fillRect(0, 0, 64, 64);
  ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 6; ctx.strokeRect(3, 3, 58, 58);
  ctx.fillStyle = '#1a1a1a';
  ctx.font = 'bold 38px Arial';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('!', 32, 35);
  mineSignTex = new THREE.CanvasTexture(c);
  mineSignTex.colorSpace = THREE.SRGBColorSpace;
  return mineSignTex;
}
function makeTentPrism(len, h, w, mat) {
  const cyl = new THREE.CylinderGeometry(w * 0.62, w * 0.62, len, 3, 1);
  cyl.rotateZ(Math.PI / 2);
  cyl.rotateY(Math.PI / 2);
  const m = new THREE.Mesh(cyl, mat);
  m.scale.set(1, h / (w * 0.62 * 1.5), 1);
  return m;
}
function addBunkerBody(g, w, h, d, mat, roofMat) {
  const base = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  base.position.y = h / 2;
  g.add(base);
  // Sloped roof: two slabs meeting at ridge
  const slabW = Math.hypot(w / 2, h * 0.42) + 0.15;
  const ang = Math.atan2(h * 0.42, w / 2);
  [-1, 1].forEach((s) => {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(slabW, 0.22, d + 0.2), roofMat);
    slab.position.set(s * w / 4, h + h * 0.21 - 0.05, 0);
    slab.rotation.z = -s * ang;
    g.add(slab);
  });
  // Embrasure slit
  const slit = new THREE.Mesh(new THREE.BoxGeometry(w * 0.62, h * 0.22, 0.12), lam(0x171713));
  slit.position.set(0, h * 0.58, d / 2 + 0.02);
  g.add(slit);
}
function addDecal(g, faction, size, x, y, z, ry = 0) {
  const d = makeDecal(faction, size);
  d.position.set(x, y, z);
  d.rotation.y = ry;
  g.add(d);
}

export function makeFortMesh(faction, key) {
  const g = new THREE.Group();
  g.userData.buildingType = key;
  const F = FACTIONS[faction];
  const trim = std(F.color, { roughness: 0.6, metalness: 0.25 });

  switch (key) {
    case 'sandbag_line':
      for (let i = 0; i < 9; i++) addBag(g, -2.6 + i * 0.65, 0.32, 0, 1);
      for (let i = 0; i < 8; i++) addBag(g, -2.28 + i * 0.65, 0.82, 0.05, 1);
      break;
    case 'sandbag_curve':
      bagArc(g, 9, 2.6, 0.32, 1, Math.PI * 0.95);
      bagArc(g, 7, 2.1, 0.82, 0.95, Math.PI * 0.8);
      break;
    case 'sandbag_revetment':
      bagArc(g, 7, 2.0, 0.32, 1.05, Math.PI * 0.75);
      bagArc(g, 5, 1.45, 0.83, 1.0, Math.PI * 0.55);
      [-1.6, 1.6].forEach(sx => { addBag(g, sx, 0.3, 1.1, 1); addBag(g, sx, 0.3, 1.75, 0.95); });
      break;
    case 'sandbag_foxhole':
      bagArc(g, 10, 1.45, 0.3, 0.9, Math.PI * 2);
      darkPatch(g, 1.3);
      break;
    case 'sandbag_pyramid':
      [[-0.9, 0.3, -0.5], [0.1, 0.3, -0.55], [1.05, 0.3, -0.4], [-0.45, 0.3, 0.45], [0.6, 0.3, 0.4], [-0.35, 0.85, 0], [0.45, 0.85, -0.05], [0.05, 1.38, 0.05]].forEach(([x, y, z]) => addBag(g, x, y, z, 1));
      break;
    case 'log_wall':
      addLog(g, 0, 0.38, 0, 5.6, 0.32, 'x');
      addLog(g, 0.2, 0.97, 0.1, 5.2, 0.3, 'x');
      addLog(g, -0.15, 1.54, -0.08, 5.0, 0.28, 'x');
      [-2.5, 0, 2.5].forEach(x => addPost(g, x, 0.1, 2.1, 0.14));
      break;
    case 'crate_wall':
      [[-1.8, 0.36, 0, 1, 0.1], [-0.85, 0.36, 0.1, 1.05, -0.12], [0.15, 0.36, -0.05, 0.95, 0.22], [1.1, 0.36, 0.08, 1, -0.2], [2.0, 0.36, -0.02, 0.9, 0.3], [-1.35, 1.08, 0.05, 0.9, 0.35], [-0.2, 1.08, 0, 1, -0.28], [0.95, 1.08, 0.05, 0.8, 0.15], [-0.7, 1.72, 0.02, 0.7, 0.5]].forEach(([x, y, z, s, ry]) => addCrate(g, x, y, z, s, ry));
      break;
    case 'tire_stack':
      [[-0.75, 0.32, 0.2, 1.1], [0.65, 0.3, -0.3, 1.05], [-0.1, 1.05, 0, 1.0], [1.45, 0.28, 0.55, 0.9]].forEach(([x, y, z, s]) => {
        const t = new THREE.Mesh(new THREE.TorusGeometry(0.62 * s, 0.27 * s, 6, 12), tireMat);
        t.rotation.x = Math.PI / 2;
        t.position.set(x, y, z);
        g.add(t);
      });
      break;
    case 'concrete_wall': {
      const w = new THREE.Mesh(new THREE.BoxGeometry(6.3, 2.15, 1.15), concreteMatF);
      w.position.y = 1.08; g.add(w);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(6.45, 0.24, 1.3), concreteDarkF);
      cap.position.y = 2.27; g.add(cap);
      [-2.4, -1.2, 0, 1.2, 2.4].forEach(x => {
        const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.1, 6), steelDarkMat);
        bolt.rotation.x = Math.PI / 2; bolt.position.set(x, 1.45, 0.6); g.add(bolt);
      });
      break;
    }
    case 'steel_wall': {
      const w = new THREE.Mesh(new THREE.BoxGeometry(6.1, 1.95, 0.85), rustMat);
      w.position.y = 0.98; g.add(w);
      for (let i = 0; i < 6; i++) {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(0.28, 2.05, 0.14), steelDarkMat);
        rib.position.set(-2.5 + i, 1.0, 0.48); g.add(rib);
      }
      const rail = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.2, 0.28), steelDarkMat);
      rail.position.set(0, 2.05, 0); g.add(rail);
      break;
    }
    case 'stone_wall': {
      const w = new THREE.Mesh(new THREE.BoxGeometry(5.9, 1.65, 1.05), stoneMat);
      w.position.y = 0.83; g.add(w);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(6.05, 0.22, 1.2), lam(0x565550));
      cap.position.y = 1.75; g.add(cap);
      [[-1.8, 0.9], [0, 0.6], [1.6, 1.1]].forEach(([x, y]) => {
        const seam = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 0.05), lam(0x4a4942));
        seam.position.set(x, y, 0.54); g.add(seam);
      });
      break;
    }
    case 'rubble_mound':
      darkPatch(g, 2.6);
      [[0, 0.5, 0, 1.5], [-1.2, 0.42, 0.5, 1.1], [1.15, 0.45, -0.4, 1.2], [-0.5, 1.15, 0.2, 1.0], [0.7, 1.1, -0.15, 0.85], [0.1, 1.75, 0.1, 0.7]].forEach(([x, y, z, s]) => {
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.75 * s, 0), lam([0x6a6860, 0x59574f, 0x76746a][(x * 10 + z * 7 + 99) % 3 | 0]));
        rock.position.set(x, y * s * 0.8, z);
        rock.rotation.set(x * 2.1, z * 1.7, y * 1.3);
        g.add(rock);
      });
      break;
    case 'dragons_teeth':
      [-2.4, -1.2, 0, 1.2, 2.4].forEach((x, i) => {
        const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.58, 1.55, 4), concreteMatF);
        tooth.position.set(x, 0.78, (i % 2 ? 0.28 : -0.28));
        tooth.rotation.y = Math.PI / 4;
        g.add(tooth);
      });
      break;
    case 'hedgehog':
      [-1.9, 0, 1.9].forEach((x, i) => {
        const beamLen = i === 1 ? 2.7 : 2.0;
        const t1 = new THREE.Mesh(new THREE.BoxGeometry(beamLen, 0.3, 0.3), steelDarkMat);
        t1.position.set(x, 0.85, 0); t1.rotation.z = Math.PI / 4; g.add(t1);
        const t2 = new THREE.Mesh(new THREE.BoxGeometry(beamLen, 0.3, 0.3), steelDarkMat);
        t2.position.set(x, 0.85, 0); t2.rotation.z = -Math.PI / 4; t2.rotation.y = 0.5; g.add(t2);
        const t3 = new THREE.Mesh(new THREE.BoxGeometry(beamLen * 0.8, 0.3, 0.3), steelDarkMat);
        t3.position.set(x, 0.75, 0); t3.rotation.x = Math.PI / 2.6; g.add(t3);
      });
      break;
    case 'barbed_wire': {
      [-2.6, 0, 2.6].forEach(x => addPost(g, x, 0, 1.5, 0.07));
      [0.5, 0.95, 1.4].forEach(y => {
        const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 5.3, 4), steelDarkMat);
        wire.rotation.z = Math.PI / 2; wire.position.set(0, y, 0); g.add(wire);
      });
      [-1.3, 1.3].forEach(x => {
        const diag = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.65, 4), steelDarkMat);
        diag.rotation.z = Math.PI / 4; diag.position.set(x, 0.95, 0); g.add(diag);
      });
      [-1.6, 1.4].forEach(x => {
        const coil = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.06, 4, 10), rustMat);
        coil.rotation.x = Math.PI / 2; coil.position.set(x, 0.12, 0.55); g.add(coil);
      });
      break;
    }
    case 'minefield': {
      addPost(g, 0, 0, 1.25, 0.09);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), new THREE.MeshLambertMaterial({ map: getMineSignTexture(), side: THREE.DoubleSide }));
      sign.position.set(0, 1.15, 0);
      g.add(sign);
      [[-1.3, 0.5], [0.9, -0.8], [0.5, 1.1]].forEach(([x, z]) => {
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.16, 10), steelDarkMat);
        disc.position.set(x, 0.08, z);
        g.add(disc);
      });
      break;
    }
    case 'barrel_cluster':
      [[-0.8, 0.48, 0.2], [0.1, 0.48, -0.5], [0.85, 0.48, 0.35], [-0.15, 0.48, 0.75], [0.35, 1.42, -0.1], [-0.75, 1.42, -0.35]].forEach(([x, y, z]) => addBarrel(g, x, y, z, fuelBarrelMat, 1.02));
      break;
    case 'camo_screen': {
      [-2.3, 0, 2.3].forEach(x => addPost(g, x, 0, 2.5, 0.08));
      const net = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 2.0), new THREE.MeshLambertMaterial({ map: getNetTexture(), side: THREE.DoubleSide, transparent: true, opacity: 0.96 }));
      net.position.set(0, 1.6, 0);
      net.rotation.x = 0.1;
      g.add(net);
      break;
    }
    case 'trench_line': {
      const pit = new THREE.Mesh(new THREE.BoxGeometry(6.3, 0.55, 1.75), earthDark);
      pit.position.y = 0.26; g.add(pit);
      for (let i = 0; i < 6; i++) addBag(g, -2.6 + i * 1.05, 0.68, 0.95, 1);
      const berm = new THREE.Mesh(new THREE.BoxGeometry(6.3, 0.5, 0.9), lam(0x4a4130));
      berm.position.set(0, 0.42, -1.15); berm.rotation.x = 0.22; g.add(berm);
      break;
    }
    case 'dugout': {
      const hut = new THREE.Mesh(new THREE.BoxGeometry(3.3, 1.35, 2.5), timberMat);
      hut.position.y = 0.68; g.add(hut);
      [-1, 1].forEach(s => {
        const slab = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.18, 2.6), lam(0x38301f));
        slab.position.set(s * 0.82, 1.72, 0); slab.rotation.z = -s * 0.52; g.add(slab);
      });
      addBag(g, -1.1, 1.75, -0.5, 1); addBag(g, 0.1, 1.85, 0.1, 1); addBag(g, 1.15, 1.72, -0.4, 0.9);
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.95, 0.1), lam(0x171713));
      door.position.set(0, 0.48, 1.26); g.add(door);
      break;
    }
    case 'mg_nest':
      bagArc(g, 6, 1.95, 0.3, 1, Math.PI * 0.8);
      bagArc(g, 5, 1.4, 0.78, 0.9, Math.PI * 0.62);
      darkPatch(g, 1.5);
      addPost(g, 0, 0.35, 0.75, 0.08);
      { const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.55, 6), steelDarkMat); gun.rotation.x = Math.PI / 2 - 0.1; gun.position.set(0, 0.95, 0.55); g.add(gun); }
      { const body = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.5), steelDarkMat); body.position.set(0, 0.98, -0.15); g.add(body); }
      break;
    case 'sniper_hide':
      bagArc(g, 5, 1.6, 0.3, 0.95, Math.PI * 0.75);
      bagArc(g, 4, 1.1, 0.75, 0.85, Math.PI * 0.6);
      darkPatch(g, 1.2);
      { const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 2.5, 6), steelDarkMat); barrel.rotation.x = Math.PI / 2 - 0.16; barrel.position.set(0, 1.0, 0.6); g.add(barrel); }
      { const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.3, 6), steelDarkMat); scope.position.set(0, 1.18, -0.25); g.add(scope); }
      break;
    case 'pillbox_mg':
      addBunkerBody(g, 4.3, 1.85, 3.3, concreteMatF, concreteDarkF);
      { const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 1.35, 6), steelDarkMat); gun.rotation.x = Math.PI / 2; gun.position.set(0, 1.15, 2.1); g.add(gun); }
      addDecal(g, faction, 0.85, 0, 1.15, 1.68);
      break;
    case 'at_pit': {
      bagArc(g, 7, 2.15, 0.32, 1, Math.PI * 0.85);
      bagArc(g, 6, 1.6, 0.82, 0.95, Math.PI * 0.7);
      darkPatch(g, 1.6);
      [-0.85, 0.85].forEach(x => { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.28, 10), tireMat); w.rotation.z = Math.PI / 2; w.position.set(x, 0.45, -0.4); g.add(w); });
      const shield = new THREE.Mesh(new THREE.BoxGeometry(1.85, 1.05, 0.09), trim);
      shield.position.set(0, 1.15, 0.35); shield.rotation.x = -0.16; g.add(shield);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.11, 2.7, 7), steelDarkMat);
      barrel.rotation.x = Math.PI / 2 - 0.13; barrel.position.set(0, 1.28, 1.25); g.add(barrel);
      break;
    }
    case 'pillbox_at':
      addBunkerBody(g, 5.2, 2.2, 3.9, concreteMatF, concreteDarkF);
      { const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 2.1, 7), steelDarkMat); gun.rotation.x = Math.PI / 2; gun.position.set(0, 1.35, 2.45); g.add(gun); }
      addDecal(g, faction, 1.05, 0, 1.35, 1.98);
      break;
    case 'cannon_pit': {
      bagArc(g, 6, 2.3, 0.32, 1, Math.PI * 0.75);
      darkPatch(g, 1.9);
      [-0.9, 0.9].forEach(x => { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.34, 10), tireMat); w.rotation.z = Math.PI / 2; w.position.set(x, 0.5, 0.15); g.add(w); });
      const shield = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.15, 0.1), trim);
      shield.position.set(0, 1.42, 0.72); shield.rotation.x = -0.2; g.add(shield);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.16, 3.3, 7), steelDarkMat);
      barrel.rotation.x = Math.PI / 2 - 0.5; barrel.position.set(0, 2.1, 0.95); g.add(barrel);
      [-0.55, 0.55].forEach(s => { const trail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 2.0), steelDarkMat); trail.position.set(s, 0.4, -1.5); trail.rotation.y = s * 0.35; g.add(trail); });
      break;
    }
    case 'pillbox_heavy':
      addBunkerBody(g, 5.9, 2.55, 4.5, concreteMatF, concreteDarkF);
      [-0.35, 0.35].forEach(x => { const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 1.5, 6), steelDarkMat); gun.rotation.x = Math.PI / 2; gun.position.set(x, 1.55, 2.72); g.add(gun); });
      addDecal(g, faction, 1.35, 0, 1.45, 2.28);
      { const net = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 1.7), new THREE.MeshLambertMaterial({ map: getNetTexture(), side: THREE.DoubleSide })); net.position.set(0, 3.6, 0); net.rotation.x = -0.28; g.add(net); }
      break;
    case 'pillbox_hq':
      addBunkerBody(g, 5.1, 2.2, 4.1, concreteMatF, concreteDarkF);
      { const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 1.35, 6), steelDarkMat); gun.rotation.x = Math.PI / 2; gun.position.set(0, 1.3, 2.55); g.add(gun); }
      addDecal(g, faction, 1.15, 0, 1.35, 2.08);
      [-1.6, 1.6].forEach((x, i) => { const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 2.1 + i, 5), steelDarkMat); ant.position.set(x, 3.25 + i * 0.5, -0.8); g.add(ant); });
      { const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.7, 5), timberMat); pole.position.set(2.0, 3.2, 0.8); g.add(pole);
        const pennant = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.55), new THREE.MeshLambertMaterial({ map: getFlagTexture(faction), side: THREE.DoubleSide })); pennant.position.set(2.48, 3.75, 0.8); g.add(pennant); }
      break;
    case 'hospital': {
      const tent = makeTentPrism(4.6, 2.0, 2.5, canvasWhite);
      tent.position.y = 1.15; g.add(tent);
      const cross = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.15), new THREE.MeshBasicMaterial({ map: makeCrossTexture(), transparent: true, side: THREE.DoubleSide }));
      cross.position.set(0, 1.35, 1.32); g.add(cross);
      addCrate(g, 2.4, 0.36, 0.6, 0.8, 0.3);
      break;
    }
    case 'workshop': {
      const box = new THREE.Mesh(new THREE.BoxGeometry(3.7, 2.0, 2.7), rustMat);
      box.position.y = 1.0; g.add(box);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.22, 2.9), steelDarkMat);
      roof.position.y = 2.1; g.add(roof);
      const door = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.35, 0.12), lam(0x171713));
      door.position.set(-0.7, 0.68, 1.38); g.add(door);
      { const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.22, 6, 12), tireMat); wheel.position.set(1.6, 0.55, 1.35); wheel.rotation.y = 0.4; g.add(wheel); }
      { const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 1.1, 6), steelDarkMat); pipe.position.set(1.1, 2.6, -0.8); g.add(pipe); }
      break;
    }
    case 'tower': {
      [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]].forEach(([x, z]) => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 3.4, 5), timberMat);
        leg.position.set(x * 1.25, 1.7, z * 1.25);
        leg.rotation.z = x * 0.09; leg.rotation.x = -z * 0.09;
        g.add(leg);
      });
      const deck = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.22, 2.3), timberMat);
      deck.position.y = 3.45; g.add(deck);
      [[-1.05, 0, 0.12, 2.3], [1.05, 0, 0.12, 2.3]].forEach(([x, z, w, d]) => { const rail = new THREE.Mesh(new THREE.BoxGeometry(w, 0.55, d), timberMat); rail.position.set(x, 3.85, z); g.add(rail); });
      [[0, -1.05, 2.3, 0.12], [0, 1.05, 2.3, 0.12]].forEach(([x, z, w, d]) => { const rail = new THREE.Mesh(new THREE.BoxGeometry(w, 0.55, d), timberMat); rail.position.set(x, 3.85, z); g.add(rail); });
      const roof = new THREE.Mesh(new THREE.ConeGeometry(1.55, 1.0, 4), canvasOlive);
      roof.position.y = 5.0; roof.rotation.y = Math.PI / 4; g.add(roof);
      const ladder = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3.1, 0.08), lam(0x38301f));
      ladder.position.set(0, 1.7, 1.18); ladder.rotation.x = 0.18; g.add(ladder);
      break;
    }
    case 'obs_post': {
      const hut = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 2.4), concreteMatF);
      hut.position.y = 0.8; g.add(hut);
      const slit = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.28, 0.1), lam(0x171713));
      slit.position.set(0, 1.25, 1.22); g.add(slit);
      const peri = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.9, 6), steelDarkMat);
      peri.position.set(0, 2.05, 0); g.add(peri);
      const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.5, 6), steelDarkMat);
      stub.rotation.x = Math.PI / 2; stub.position.set(0, 2.42, 0.2); g.add(stub);
      break;
    }
    case 'radio_mast': {
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.24, 8.4, 6), steelDarkMat);
      mast.position.y = 4.2; g.add(mast);
      for (let i = 0; i < 4; i++) {
        const brace = new THREE.Mesh(new THREE.BoxGeometry(0.9 - i * 0.16, 0.07, 0.07), steelDarkMat);
        brace.position.y = 1.6 + i * 1.8;
        brace.rotation.y = i * 0.8;
        g.add(brace);
      }
      [0, 1, 2].forEach(i => {
        const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 5.2, 4), steelDarkMat);
        const a = (i / 3) * Math.PI * 2;
        wire.position.set(Math.cos(a) * 1.6, 2.1, Math.sin(a) * 1.6);
        wire.rotation.z = Math.cos(a) * 0.62;
        wire.rotation.x = Math.sin(a) * 0.62;
        g.add(wire);
      });
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.17, 6, 5), new THREE.MeshStandardMaterial({ color: 0xff4030, emissive: 0xff2010, emissiveIntensity: 1.6 }));
      tip.position.y = 8.6; g.add(tip);
      g.userData.beacon = tip;
      break;
    }
    case 'fdc': {
      addBunkerBody(g, 3.6, 1.7, 2.9, concreteMatF, concreteDarkF);
      const table = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 1.0), timberMat);
      table.position.set(0, 0.35, 2.2); g.add(table);
      const mapBoard = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.06, 0.8), lam(0x8a8264));
      mapBoard.position.set(0, 0.74, 2.2); g.add(mapBoard);
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 3.1, 5), steelDarkMat);
      ant.position.set(1.2, 3.2, -0.7); g.add(ant);
      addDecal(g, faction, 0.7, 0, 1.15, 1.48);
      break;
    }
    case 'ammo_depot': {
      const box = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1.85, 2.7), lam(0x4a4036));
      box.position.y = 0.93; g.add(box);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(3.65, 0.2, 2.85), steelDarkMat);
      roof.position.y = 1.95; g.add(roof);
      // Shell pyramids
      [[-1.15, 0.32], [-0.45, 0.32], [0.25, 0.32], [-0.8, 0.72], [-0.1, 0.72], [-0.45, 1.1]].forEach(([x, y]) => {
        const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.55, 6), lam(0x8a7a3a));
        shell.position.set(x, y, 1.6); g.add(shell);
      });
      const door = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.3, 0.1), lam(0x2a2620));
      door.position.set(0.9, 0.66, 1.38); g.add(door);
      break;
    }
    case 'fuel_depot': {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 4.1, 12), lam(0x3a3a30));
      tank.rotation.z = Math.PI / 2;
      tank.position.set(0, 1.15, 0); g.add(tank);
      [[-1.2], [1.2]].forEach(([x]) => { const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 1.4), concreteDarkF); saddle.position.set(x, 0.27, 0); g.add(saddle); });
      addBarrel(g, -2.35, 0.48, 0.9, fuelBarrelMat, 0.95);
      addBarrel(g, -2.35, 0.48, -0.2, drumMat, 0.95);
      { const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.8, 6), steelDarkMat); pipe.rotation.z = Math.PI / 2; pipe.position.set(2.85, 0.75, 0.3); g.add(pipe); }
      break;
    }
    case 'field_kitchen': {
      const hut = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.4, 1.9), lam(0x4f4a38));
      hut.position.y = 0.7; g.add(hut);
      const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 1.35, 6), steelDarkMat);
      chimney.position.set(0.75, 1.95, -0.4); g.add(chimney);
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.32, 0.3, 9), steelDarkMat);
      pot.position.set(-1.45, 0.9, 0.4); g.add(pot);
      addCrate(g, 1.5, 0.36, 0.75, 0.75, 0.4);
      break;
    }
    case 'tent': {
      const tent = makeTentPrism(3.1, 1.65, 1.7, canvasOlive);
      tent.position.y = 0.95; g.add(tent);
      addPost(g, 0, 1.45, 1.0, 0.06);
      break;
    }
    case 'supply_tent': {
      const tent = makeTentPrism(3.3, 1.7, 1.8, canvasKhaki);
      tent.position.y = 0.98; g.add(tent);
      addCrate(g, 1.9, 0.34, 0.5, 0.75, 0.2);
      addCrate(g, 2.35, 0.3, -0.45, 0.65, -0.3);
      break;
    }
    case 'camo_tent': {
      const tent = makeTentPrism(3.1, 1.6, 1.7, lam(0x4a4a34));
      tent.position.y = 0.92; g.add(tent);
      const net = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.1), new THREE.MeshLambertMaterial({ map: getNetTexture(), side: THREE.DoubleSide }));
      net.position.set(0, 1.75, 0); net.rotation.x = -0.22; g.add(net);
      break;
    }
    case 'barracks_tent': {
      const tent = makeTentPrism(6.2, 2.0, 2.3, canvasOlive);
      tent.position.y = 1.15; g.add(tent);
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.05, 0.1), lam(0x171713));
      door.position.set(1.2, 0.53, 1.28); g.add(door);
      addDecal(g, faction, 0.62, -1.4, 1.15, 1.22);
      break;
    }
    case 'tent_line':
      [[-2.2, 0.15], [0, -0.2], [2.2, 0.3]].forEach(([x, z], i) => {
        const tent = makeTentPrism(2.6, 1.5, 1.55, [canvasOlive, canvasKhaki, lam(0x565544)][i]);
        tent.position.set(x, 0.9, z);
        g.add(tent);
      });
      break;
    case 'supply_crates':
      [[-0.8, 0.36, 0.15, 1, 0.2], [0.35, 0.36, -0.3, 0.9, -0.25], [1.1, 0.33, 0.45, 0.8, 0.45], [-0.25, 1.08, 0, 0.8, -0.35]].forEach(([x, y, z, s, ry]) => addCrate(g, x, y, z, s, ry));
      break;
    case 'fuel_tank': {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.92, 3.3, 12), lam(0x3a3a30));
      tank.rotation.z = Math.PI / 2;
      tank.position.set(0, 1.05, 0); g.add(tank);
      [[-1.0], [1.0]].forEach(([x]) => { const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 1.25), concreteDarkF); saddle.position.set(x, 0.25, 0); g.add(saddle); });
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.18, 8), steelDarkMat);
      cap.position.set(0.9, 2.0, 0); g.add(cap);
      break;
    }
    case 'spare_parts':
      addCrate(g, -0.6, 0.35, 0.1, 0.85, 0.3);
      addCrate(g, 0.75, 0.33, -0.35, 0.75, -0.2);
      { const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.18, 6, 12), tireMat); wheel.position.set(0.5, 0.48, 0.65); wheel.rotation.y = 0.5; g.add(wheel); }
      [[-0.9, 0.2], [1.0, 0.25], [0.1, -0.6]].forEach(([x, z]) => { const part = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.3), steelDarkMat); part.position.set(x, 0.09, z); part.rotation.y = x * 1.7; g.add(part); });
      break;
    case 'wood_pile':
      [[-0.75, 0.3, 0.1, 0], [0.35, 0.3, -0.25, 0.15], [1.25, 0.3, 0.25, -0.1], [-0.2, 0.88, 0, 0.08], [0.8, 0.88, -0.1, -0.12], [0.3, 1.44, 0.05, 0.05]].forEach(([x, y, z, ry]) => addLog(g, x, y, z, 1.7, 0.26, 'x', ry));
      break;
    case 'barrel_rack': {
      [-1.15, 1.15].forEach(x => addPost(g, x, 0, 1.6, 0.09));
      [0.55, 1.1].forEach(y => { const rail = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.09, 0.09), timberMat); rail.position.set(0, y, 0.32); g.add(rail); });
      [[-0.75, 0.48], [0, 0.48], [0.75, 0.48]].forEach(([x, y]) => addBarrel(g, x, y, 0, drumMat, 0.88));
      break;
    }
    case 'water_tower': {
      [[-0.95, -0.95], [0.95, -0.95], [-0.95, 0.95], [0.95, 0.95]].forEach(([x, z]) => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 3.6, 5), timberMat);
        leg.position.set(x * 1.15, 1.8, z * 1.15);
        leg.rotation.z = x * 0.085; leg.rotation.x = -z * 0.085;
        g.add(leg);
      });
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.35, 1.7, 12), rustMat);
      tank.position.y = 4.35; g.add(tank);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.75, 12), steelDarkMat);
      roof.position.y = 5.55; g.add(roof);
      { const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 3.4, 6), steelDarkMat); pipe.position.set(0, 1.7, 0); g.add(pipe); }
      break;
    }
    default: {
      // Fallback: look like a bunker rather than nothing
      const box = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.6, 2.0), concreteMatF);
      box.position.y = 0.8; g.add(box);
    }
  }

  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// Cross texture for the field hospital (green cross = aid station)
let crossTex = null;
function makeCrossTexture() {
  if (crossTex) return crossTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 64, 64);
  ctx.fillStyle = '#2e6b3e';
  ctx.fillRect(22, 6, 20, 52);
  ctx.fillRect(6, 22, 52, 20);
  crossTex = new THREE.CanvasTexture(c);
  crossTex.colorSpace = THREE.SRGBColorSpace;
  return crossTex;
}

// ---------- Buildings ----------
export function makeBuildingMesh(side, type) {
  if (!['hq', 'barracks', 'factory'].includes(type)) {
    return makeFortMesh(side, type);
  }
  const F = FACTIONS[side];
  const g = new THREE.Group();
  const concrete = lam(0x6f6e66);
  const concreteDark = lam(0x55544d);
  const trim = std(F.color, { roughness: 0.6, metalness: 0.25 });
  const roofMat = lam(0x3f3d36);

  if (type === 'hq') {
    const bunker = new THREE.Mesh(new THREE.BoxGeometry(11.5, 3.1, 8), concrete);
    bunker.position.y = 1.55; g.add(bunker);
    const upper = new THREE.Mesh(new THREE.BoxGeometry(7.6, 2.15, 5.1), concreteDark);
    upper.position.y = 4.15; g.add(upper);
    // Sloped roof slabs
    [-1, 1].forEach((s) => {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(4.35, 0.24, 5.3), roofMat);
      slab.position.set(s * 1.94, 5.58, 0);
      slab.rotation.z = -s * 0.46;
      g.add(slab);
    });
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 5.35), roofMat);
    ridge.position.set(0, 6.32, 0); g.add(ridge);
    // Door + windows
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.9, 2.1, 0.18), lam(0x2c2a24));
    door.position.set(0, 1.05, 4.02); g.add(door);
    const winMat = new THREE.MeshStandardMaterial({ color: 0x241f14, emissive: 0x514628, emissiveIntensity: 0.85, roughness: 0.4 });
    [[-3.6, 1.9, 4.02], [3.6, 1.9, 4.02], [-2.1, 4.2, 2.58], [0, 4.2, 2.58], [2.1, 4.2, 2.58]].forEach(([wx, wy, wz]) => {
      const win = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.78, 0.14), winMat);
      win.position.set(wx, wy, wz); g.add(win);
    });
    // Faction insignia on the bunker face
    const decal = makeDecal(side, 2.3);
    decal.position.set(0, 2.6, 4.03); g.add(decal);
    // Trim stripe
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(11.55, 0.42, 8.02), trim);
    stripe.position.y = 3.05; g.add(stripe);
    // Roof flag pole + pennant
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 2.6, 5), lam(0x4c463c));
    pole.position.set(-2.9, 7.3, 0); g.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 0.8), new THREE.MeshLambertMaterial({ map: getFlagTexture(side), side: THREE.DoubleSide }));
    flag.position.set(-2.22, 8.05, 0); g.add(flag);
    g.userData.flagCloth = flag;
    // Antenna with blinking tip
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 4.4, 5), lam(0x2e2c26));
    antenna.position.set(3.1, 8, -1.4); g.add(antenna);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 5), new THREE.MeshStandardMaterial({ color: 0xff4030, emissive: 0xff2010, emissiveIntensity: 1.6 }));
    tip.position.set(3.1, 10.25, -1.4); g.add(tip);
    g.userData.beacon = tip;
    // Sandbag ring (flattened spheres)
    const bagGeo = new THREE.SphereGeometry(0.52, 6, 5);
    const bagMat = lam(0x57503c);
    const bags = new THREE.InstancedMesh(bagGeo, bagMat, 26);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1.15, 0.55, 0.8), p = new THREE.Vector3();
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      p.set(Math.cos(a) * 7.6, 0.32, Math.sin(a) * 5.6);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a);
      m.compose(p, q, s);
      bags.setMatrixAt(i, m);
    }
    bags.castShadow = true;
    g.add(bags);
  }

  else if (type === 'barracks') {
    const hut = new THREE.Mesh(new THREE.BoxGeometry(9.2, 2.5, 4.3), lam(0x5e5c50));
    hut.position.y = 1.25; g.add(hut);
    [-1, 1].forEach((s) => {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(5.35, 0.2, 4.4), roofMat);
      slab.position.set(s * 2.36, 2.95, 0);
      slab.rotation.z = -s * 0.44;
      g.add(slab);
    });
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.35, 1.7, 0.16), lam(0x2c2a24));
    door.position.set(-2.4, 0.85, 2.18); g.add(door);
    const winMat = new THREE.MeshStandardMaterial({ color: 0x241f14, emissive: 0x474020, emissiveIntensity: 0.7 });
    [[0.4, 1.45, 2.18], [2.6, 1.45, 2.18], [-0.4, 1.45, -2.18], [-2.2, 1.45, -2.18]].forEach(([wx, wy, wz]) => {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.7, 0.14), winMat);
      win.position.set(wx, wy, wz); g.add(win);
    });
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 1.15, 6), lam(0x35322b));
    pipe.position.set(3.1, 3.35, -1.1); g.add(pipe);
    const decal = makeDecal(side, 1.15);
    decal.position.set(2.2, 1.5, 2.19); g.add(decal);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(9.25, 0.3, 4.32), trim);
    stripe.position.y = 2.28; g.add(stripe);
  }

  else if (type === 'factory') {
    const hall = new THREE.Mesh(new THREE.BoxGeometry(11, 3.7, 7.2), concreteDark);
    hall.position.y = 1.85; g.add(hall);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(11.2, 0.32, 7.4), roofMat);
    roof.position.y = 3.85; g.add(roof);
    // Sawtooth glazing strips
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x2a2418, emissive: 0x6b5c2a, emissiveIntensity: 1.0 });
    [-3.4, 0, 3.4].forEach((gx) => {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.0, 0.14), glassMat);
      strip.position.set(gx, 3.32, 3.62); g.add(strip);
    });
    // Smokestacks
    const stackMat = lam(0x4a3830);
    [[-3.6, -1.8], [3.6, -1.8]].forEach(([sx, sz]) => {
      const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.72, 5.4, 8), stackMat);
      stack.position.set(sx, 6.4, sz); g.add(stack);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.35, 8), lam(0x7a2e22));
      band.position.set(sx, 8.35, sz); g.add(band);
    });
    g.userData.smokestacks = [[-3.6, 9.2, -1.8], [3.6, 9.2, -1.8]];
    // Big door
    const door = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.7, 0.2), lam(0x35322b));
    door.position.set(0, 1.35, 3.62); g.add(door);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.28, 0.24), lam(0x211f1a));
    rail.position.set(0, 2.8, 3.7); g.add(rail);
    // Crane post + arm
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.45, 5.2, 0.45), lam(0x6b5a2a));
    post.position.set(-6.3, 2.6, 1.2); g.add(post);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.32, 0.32), lam(0x6b5a2a));
    arm.position.set(-4.6, 4.9, 1.2); g.add(arm);
    const decal = makeDecal(side, 1.5);
    decal.position.set(0, 2.1, 3.63); decal.position.y = 1.1; decal.position.x = -3.6;
    g.add(decal);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(11.05, 0.36, 7.22), trim);
    stripe.position.y = 0.55; g.add(stripe);
  }

  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.userData.buildingType = type;
  return g;
}

// ---------- Health bars (world-space billboards) ----------
export function makeHealthBar(width = 2.3, height = 0.32) {
  const group = new THREE.Group();
  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ color: 0x050505, transparent: true, opacity: 0.82, depthTest: false, depthWrite: false })
  );
  const fg = new THREE.Mesh(
    new THREE.PlaneGeometry(width - 0.08, height - 0.1),
    new THREE.MeshBasicMaterial({ color: 0x7fd06a, depthTest: false, depthWrite: false, transparent: true })
  );
  fg.position.z = 0.001;
  group.add(bg, fg);
  group.renderOrder = 999;
  bg.renderOrder = 999; fg.renderOrder = 1000;
  group.visible = false;
  return { group, fg, width: width - 0.08, height };
}
export function setHealthBar(bar, frac, colorHex) {
  frac = clamp01(frac);
  bar.fg.scale.x = Math.max(0.0001, frac);
  bar.fg.position.x = -bar.width / 2 + (bar.width * frac) / 2;
  if (colorHex !== undefined) bar.fg.material.color.setHex(colorHex);
  else bar.fg.material.color.setHex(frac > 0.55 ? 0x7fd06a : frac > 0.28 ? 0xe0c060 : 0xe0604a);
}
function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
export function healthColor(frac) { return frac > 0.55 ? 0x7fd06a : frac > 0.28 ? 0xe0c060 : 0xe0604a; }
