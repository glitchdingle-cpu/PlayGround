// Mesh factories for units and buildings + shared health bar widget.
import * as THREE from 'three';
import { FACTIONS, BUILDING_DEFS } from './config.js';
import { terrainHeight } from './world.js';

const decalCache = {};
function decalTexture(side) {
  if (decalCache[side]) return decalCache[side];
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 128, 128);
  if (FACTIONS[side].insignia === 'star') {
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
  } else {
    ctx.fillStyle = '#141414';
    ctx.strokeStyle = '#e6e3d8'; ctx.lineWidth = 10;
    // Greek cross (historical Balkenkreuz silhouette)
    ctx.fillRect(44, 8, 40, 112); ctx.fillRect(8, 44, 112, 40);
    ctx.strokeRect(44, 8, 40, 112); ctx.strokeRect(8, 44, 112, 40);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  decalCache[side] = tex;
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
    const uniform = F.insignia === 'star' ? 0x474d2c : 0x4a5058;
    const helmet = F.insignia === 'star' ? 0x3d4226 : 0x3c434c;
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
      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.26, 0.66, 6), lam(F.insignia === 'star' ? 0x474d2c : 0x4a5058));
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

// ---------- Buildings ----------
export function makeBuildingMesh(side, type) {
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
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 0.8), new THREE.MeshLambertMaterial({ map: makeFlagTexture(side), side: THREE.DoubleSide }));
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

let flagTexCache = {};
function makeFlagTexture(side) {
  if (flagTexCache[side]) return flagTexCache[side];
  const c = document.createElement('canvas'); c.width = 128; c.height = 80;
  const ctx = c.getContext('2d');
  if (FACTIONS[side].insignia === 'star') {
    ctx.fillStyle = '#4c5133'; ctx.fillRect(0, 0, 128, 80);
    ctx.fillStyle = '#ece8d8';
    ctx.beginPath();
    const cx = 64, cy = 40, R = 22, r = 9;
    for (let i = 0; i < 10; i++) {
      const ang = -Math.PI / 2 + (i * Math.PI) / 5, rad = i % 2 === 0 ? R : r;
      const x = cx + Math.cos(ang) * rad, y = cy + Math.sin(ang) * rad;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fill();
  } else {
    ctx.fillStyle = '#4a4f57'; ctx.fillRect(0, 0, 128, 80);
    ctx.fillStyle = '#e6e3d8';
    ctx.fillRect(50, 6, 28, 68); ctx.fillRect(12, 26, 104, 28);
    ctx.fillStyle = '#151515';
    ctx.fillRect(56, 12, 16, 56); ctx.fillRect(18, 32, 92, 16);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  flagTexCache[side] = tex;
  return tex;
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
