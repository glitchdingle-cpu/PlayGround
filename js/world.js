// World construction: terrain, baked ground texture, forests, rocks, flags, sky, props.
import * as THREE from 'three';
import { fbm, flat, clamp, lerp, mulberry32 } from './noise.js';
import { MAP_SIZE, FLAT_ZONES, ROAD_POINTS, CAPTURE_POINTS, PLAYER_BASE, AXIS_BASE } from './config.js';

function distToSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const len2 = dx * dx + dz * dz;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (pz - az) * dz) / len2;
  t = clamp(t, 0, 1);
  const cx = ax + t * dx, cz = az + t * dz;
  return Math.hypot(px - cx, pz - cz);
}
export function distToRoad(x, z) {
  let best = Infinity;
  for (let i = 0; i < ROAD_POINTS.length - 1; i++) {
    const a = ROAD_POINTS[i], b = ROAD_POINTS[i + 1];
    best = Math.min(best, distToSegment(x, z, a.x, a.z, b.x, b.z));
  }
  return best;
}
export function terrainHeight(x, z) {
  let h = 1.8 + fbm(x * 0.013 + 7.3, z * 0.013 + 3.1, 4) * 12.5;
  for (const zone of FLAT_ZONES) {
    const d = Math.hypot(x - zone.x, z - zone.z);
    h = lerp(h, 2.7, flat(d, zone.r, zone.r * 0.45));
  }
  const rd = distToRoad(x, z);
  h = lerp(h, 3.1, flat(rd, 6.5, 2.2) * 0.9);
  return h;
}

// ---------- Ground texture (baked once) ----------
function bakeGroundTexture() {
  const S = 2048, px = S / MAP_SIZE;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d');
  const rng = mulberry32(90210);
  // Base muddy green-brown
  const grad = ctx.createLinearGradient(0, 0, S, S);
  grad.addColorStop(0, '#414d2d');
  grad.addColorStop(0.5, '#474f31');
  grad.addColorStop(1, '#3d472b');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, S, S);
  // Large soft blotches (grass / mud / frost)
  const blotchColors = ['#55603a', '#333d24', '#55503a', '#2f3820', '#5d5a41', '#49543a'];
  for (let i = 0; i < 900; i++) {
    const x = rng() * S, y = rng() * S, r = 18 + rng() * 130;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const col = blotchColors[(rng() * blotchColors.length) | 0];
    g.addColorStop(0, col + 'cc');
    g.addColorStop(1, col + '00');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  // Speckle noise
  for (let i = 0; i < 5200; i++) {
    ctx.fillStyle = rng() > 0.5 ? 'rgba(20,24,14,0.35)' : 'rgba(120,124,92,0.28)';
    const s = 1 + rng() * 3.4;
    ctx.fillRect(rng() * S, rng() * S, s, s);
  }
  // Frost / dead grass streaks
  ctx.globalAlpha = 0.16;
  for (let i = 0; i < 260; i++) {
    ctx.strokeStyle = rng() > 0.5 ? '#8a8564' : '#2c3320';
    ctx.lineWidth = 1 + rng() * 2;
    const x = rng() * S, y = rng() * S, a = rng() * Math.PI, len = 14 + rng() * 60;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const w2p = (x, z) => [ (x + MAP_SIZE / 2) * px, (z + MAP_SIZE / 2) * px ];
  // Road border then surface
  const drawRoad = (widthPx, style) => {
    ctx.strokeStyle = style; ctx.lineWidth = widthPx; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath();
    ROAD_POINTS.forEach((p, i) => {
      const [x, y] = w2p(p.x, p.z);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
  };
  drawRoad(54, 'rgba(38,34,25,0.95)');
  drawRoad(40, '#585040');
  // Wheel ruts (dashed darker lines offset from center)
  ctx.setLineDash([30, 22]);
  ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(46,41,31,0.7)';
  for (const off of [-12, 12]) {
    ctx.beginPath();
    ROAD_POINTS.forEach((p, i) => {
      // approximate perpendicular offset
      const next = ROAD_POINTS[Math.min(i + 1, ROAD_POINTS.length - 1)];
      const prev = ROAD_POINTS[Math.max(i - 1, 0)];
      const dx = next.x - prev.x, dz = next.z - prev.z, len = Math.hypot(dx, dz) || 1;
      const [x, y] = w2p(p.x - (dz / len) * (off / px), p.z + (dx / len) * (off / px));
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // Base aprons (packed dirt)
  for (const base of [PLAYER_BASE, AXIS_BASE]) {
    const [bx, by] = w2p(base.x, base.z);
    const g = ctx.createRadialGradient(bx, by, 10, bx, by, 30 * px);
    g.addColorStop(0, 'rgba(88,80,64,0.95)');
    g.addColorStop(0.75, 'rgba(80,74,58,0.55)');
    g.addColorStop(1, 'rgba(80,74,58,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(bx, by, 30 * px, 0, Math.PI * 2); ctx.fill();
  }
  // Craters near the midfield
  for (let i = 0; i < 16; i++) {
    const x = (rng() - 0.5) * 130, z = (rng() - 0.5) * 130;
    const [cx, cy] = w2p(x, z);
    const r = (1.2 + rng() * 2.4) * px;
    ctx.fillStyle = 'rgba(30,27,20,0.75)';
    ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.8, rng() * 3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(96,90,70,0.5)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(cx, cy, r * 1.15, r * 0.95, rng() * 3, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// ---------- Minimap base (reused by HUD) ----------
export function renderMinimapBase() {
  const S = 240, c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(S, S);
  for (let py = 0; py < S; py++) {
    for (let px2 = 0; px2 < S; px2++) {
      const x = (px2 / S - 0.5) * MAP_SIZE;
      const z = (py / S - 0.5) * MAP_SIZE;
      const h = terrainHeight(x, z);
      const rd = distToRoad(x, z);
      let r, g, b;
      const t = clamp((h - 1.5) / 12, 0, 1);
      r = lerp(56, 122, t); g = lerp(66, 116, t); b = lerp(38, 92, t);
      if (rd < 3.2) { r = 92; g = 84; b = 66; }
      const i = (py * S + px2) * 4;
      img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// ---------- Flag / insignia canvas textures ----------
function insigniaTexture(kind) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const ctx = c.getContext('2d');
  if (kind === 'star') {
    ctx.fillStyle = '#5a6136'; ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 10; ctx.strokeRect(0, 0, 128, 128);
    ctx.fillStyle = '#e8e4d0';
    ctx.beginPath();
    const cx = 64, cy = 64, R = 44, r = 18;
    for (let i = 0; i < 10; i++) {
      const ang = -Math.PI / 2 + (i * Math.PI) / 5, rad = i % 2 === 0 ? R : r;
      const x = cx + Math.cos(ang) * rad, y = cy + Math.sin(ang) * rad;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fill();
  } else if (kind === 'cross') {
    ctx.fillStyle = '#4a4f57'; ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 10; ctx.strokeRect(0, 0, 128, 128);
    ctx.fillStyle = '#e6e3d8'; ctx.fillRect(48, 10, 32, 108); ctx.fillRect(10, 48, 108, 32);
    ctx.fillStyle = '#151515'; ctx.fillRect(54, 16, 20, 96); ctx.fillRect(16, 54, 96, 20);
  } else {
    ctx.fillStyle = '#d8d5c8'; ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#8e2f22'; ctx.fillRect(0, 52, 128, 24); ctx.fillRect(52, 0, 24, 128);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------- World ----------
export function buildWorld(scene) {
  const world = new THREE.Group();
  scene.add(world);

  // Terrain
  const segs = 168;
  const geo = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE, segs, segs);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, terrainHeight(x, z));
  }
  geo.computeVertexNormals();
  const groundTex = bakeGroundTexture();
  const terrain = new THREE.Mesh(
    geo,
    new THREE.MeshLambertMaterial({ map: groundTex })
  );
  terrain.receiveShadow = true;
  terrain.name = 'terrain';
  world.add(terrain);

  // Invisible bounds reference (for edge glow, unused if fog hides edges)
  const rng = mulberry32(1337);

  // ---- Forests (instanced pines) ----
  const treePositions = [];
  let attempts = 0;
  while (treePositions.length < 240 && attempts < 4000) {
    attempts++;
    const x = (rng() - 0.5) * (MAP_SIZE - 24);
    const z = (rng() - 0.5) * (MAP_SIZE - 24);
    let blocked = false;
    for (const zone of FLAT_ZONES) if (Math.hypot(x - zone.x, z - zone.z) < zone.r + 2) { blocked = true; break; }
    if (!blocked && distToRoad(x, z) < 5) blocked = true;
    if (blocked) continue;
    const clump = fbm(x * 0.03 + 40, z * 0.03 + 9, 3);
    if (clump < 0.52 && rng() > 0.18) continue;
    treePositions.push({ x, z, s: 0.75 + rng() * 0.85, rot: rng() * Math.PI * 2 });
  }
  const trunkGeo = new THREE.CylinderGeometry(0.24, 0.34, 1.8, 5);
  const canopyGeo = new THREE.ConeGeometry(1.55, 3.6, 6);
  const canopy2Geo = new THREE.ConeGeometry(1.05, 2.4, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x3a2c20 });
  const canopyMat = new THREE.MeshLambertMaterial({ color: 0x2e4630 });
  const canopy2Mat = new THREE.MeshLambertMaterial({ color: 0x38503a });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treePositions.length);
  const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, treePositions.length);
  const canopies2 = new THREE.InstancedMesh(canopy2Geo, canopy2Mat, treePositions.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  treePositions.forEach((t, i) => {
    const y = terrainHeight(t.x, t.z);
    q.setFromAxisAngle(up, t.rot);
    sc.set(t.s, t.s, t.s);
    p.set(t.x, y + 0.9 * t.s, t.z); m.compose(p, q, sc); trunks.setMatrixAt(i, m);
    p.set(t.x, y + (1.8 + 1.5) * t.s, t.z); m.compose(p, q, sc); canopies.setMatrixAt(i, m);
    p.set(t.x, y + (1.8 + 3.1) * t.s, t.z); m.compose(p, q, sc); canopies2.setMatrixAt(i, m);
  });
  trunks.castShadow = canopies.castShadow = canopies2.castShadow = true;
  world.add(trunks, canopies, canopies2);

  // ---- Rocks ----
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  const rockMat = new THREE.MeshLambertMaterial({ color: 0x6b6a63, flatShading: true });
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, 80);
  for (let i = 0; i < 80; i++) {
    const x = (rng() - 0.5) * (MAP_SIZE - 20), z = (rng() - 0.5) * (MAP_SIZE - 20);
    const y = terrainHeight(x, z);
    const s = 0.35 + rng() * 1.15;
    q.setFromEuler(new THREE.Euler(rng() * 3, rng() * 3, rng() * 3));
    sc.set(s, s * (0.55 + rng() * 0.5), s);
    p.set(x, y + s * 0.2, z);
    m.compose(p, q, sc);
    rocks.setMatrixAt(i, m);
  }
  rocks.castShadow = true;
  world.add(rocks);

  // ---- Clouds (billboard sprites, slow drift) ----
  const cloudCanvas = document.createElement('canvas');
  cloudCanvas.width = cloudCanvas.height = 128;
  const cctx = cloudCanvas.getContext('2d');
  for (let i = 0; i < 7; i++) {
    const x = 20 + rng() * 88, y = 44 + rng() * 40, r = 12 + rng() * 22;
    const g = cctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.85)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    cctx.fillStyle = g;
    cctx.beginPath(); cctx.arc(x, y, r, 0, Math.PI * 2); cctx.fill();
  }
  const cloudTex = new THREE.CanvasTexture(cloudCanvas);
  const clouds = [];
  for (let i = 0; i < 14; i++) {
    const mat = new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.55 + rng() * 0.3, depthWrite: false });
    const sp = new THREE.Sprite(mat);
    sp.position.set((rng() - 0.5) * 420, 58 + rng() * 30, (rng() - 0.5) * 420);
    const s = 42 + rng() * 46;
    sp.scale.set(s, s * 0.62, 1);
    sp.userData.drift = 0.5 + rng() * 0.7;
    world.add(sp);
    clouds.push(sp);
  }

  // ---- Suppressive craters scattered midfield (visual only) ----
  const craterMat = new THREE.MeshBasicMaterial({ color: 0x211d15, transparent: true, opacity: 0.55, depthWrite: false });
  for (let i = 0; i < 22; i++) {
    const x = (rng() - 0.5) * 120, z = (rng() - 0.5) * 120;
    const r = 0.8 + rng() * 1.6;
    const cg = new THREE.CircleGeometry(r, 10);
    cg.rotateX(-Math.PI / 2);
    const cm = new THREE.Mesh(cg, craterMat);
    cm.position.set(x, terrainHeight(x, z) + 0.06, z);
    world.add(cm);
  }

  // ---- Capture flags ----
  const flagTextures = { neutral: insigniaTexture('plain'), player: insigniaTexture('star'), axis: insigniaTexture('cross') };
  const flags = CAPTURE_POINTS.map((cp) => {
    const g = new THREE.Group();
    const y = terrainHeight(cp.x, cp.z);
    g.position.set(cp.x, y, cp.z);
    // Pole
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.18, 4.6, 6),
      new THREE.MeshLambertMaterial({ color: 0x5c5142 })
    );
    pole.position.y = 2.3; pole.castShadow = true;
    g.add(pole);
    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), new THREE.MeshLambertMaterial({ color: 0x8f7a3a, emissive: 0x241a05 }));
    finial.position.y = 4.7;
    g.add(finial);
    // Cloth (vertex-waved in update)
    const clothGeo = new THREE.PlaneGeometry(2.1, 1.3, 10, 5);
    clothGeo.translate(1.05, 0, 0);
    const clothMat = new THREE.MeshLambertMaterial({ map: flagTextures.neutral, side: THREE.DoubleSide, emissive: 0x111111 });
    const cloth = new THREE.Mesh(clothGeo, clothMat);
    cloth.position.set(0.14, 3.85, 0);
    g.add(cloth);
    // Ground ring
    const ringGeo = new THREE.RingGeometry(7.6, 8.4, 40);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xd8d5c8, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.09;
    g.add(ring);
    world.add(g);
    return {
      id: cp.id, label: cp.label, x: cp.x, z: cp.z,
      owner: 'neutral', progress: 0, capturingSide: null,
      group: g, cloth, ring, ringMat, clothMat, flagTextures, baseY: y
    };
  });

  // ---- Props near bases: crates & barrels ----
  const crateMat = new THREE.MeshLambertMaterial({ color: 0x4f4429 });
  const barrelMat = new THREE.MeshLambertMaterial({ color: 0x35402e });
  for (const base of [PLAYER_BASE, AXIS_BASE]) {
    for (let i = 0; i < 12; i++) {
      const a = rng() * Math.PI * 2, d = 6 + rng() * 14;
      const x = base.x + Math.cos(a) * d, z = base.z + Math.sin(a) * d;
      const y = terrainHeight(x, z);
      let prop;
      if (rng() > 0.45) {
        prop = new THREE.Mesh(new THREE.BoxGeometry(0.9 + rng() * 0.7, 0.7 + rng() * 0.4, 0.9 + rng() * 0.7), crateMat);
        prop.position.set(x, y + 0.5, z);
      } else {
        prop = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.05, 8), barrelMat);
        prop.position.set(x, y + 0.55, z);
      }
      prop.rotation.y = rng() * Math.PI;
      prop.castShadow = true;
      world.add(prop);
    }
  }

  return { world, terrain, clouds, flags };
}
