// World construction: terrain, baked ground texture, forests, rocks, hedgerows, flags, sky, props.
import * as THREE from 'three';
import { fbm, flat, clamp, lerp, mulberry32 } from './noise.js';
import { MAP_SIZE, FLAT_ZONES, ROADS, CAPTURE_POINTS, BASES } from './config.js';

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
  for (const road of ROADS) {
    for (let i = 0; i < road.length - 1; i++) {
      const a = road[i], b = road[i + 1];
      best = Math.min(best, distToSegment(x, z, a.x, a.z, b.x, b.z));
    }
  }
  return best;
}
export function terrainHeight(x, z) {
  let h = 1.9 + fbm(x * 0.011 + 7.3, z * 0.011 + 3.1, 4) * 13.5;
  for (const zone of FLAT_ZONES) {
    const d = Math.hypot(x - zone.x, z - zone.z);
    h = lerp(h, 2.7, flat(d, zone.r, zone.r * 0.45));
  }
  const rd = distToRoad(x, z);
  h = lerp(h, 3.1, flat(rd, 7.0, 2.3) * 0.9);
  return h;
}

// ---------- Ground texture (baked once) ----------
function bakeGroundTexture() {
  const S = 2048, px = S / MAP_SIZE;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d');
  const rng = mulberry32(90210);
  // Base muddy green-brown gradient
  const grad = ctx.createLinearGradient(0, 0, S, S);
  grad.addColorStop(0, '#414d2d');
  grad.addColorStop(0.5, '#474f31');
  grad.addColorStop(1, '#3d472b');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, S, S);

  // ---- Field patches (Ardennes bocage) ----
  const fieldTypes = [
    { fill: '#5d5a34', line: 'rgba(40,38,20,0.55)', spacing: 9 },   // wheat
    { fill: '#4a3a28', line: 'rgba(26,20,12,0.6)', spacing: 7 },    // ploughed
    { fill: '#55603a', line: 'rgba(35,42,22,0.45)', spacing: 11 },  // pasture
    { fill: '#39434f', line: 'rgba(20,24,30,0.4)', spacing: 10 },   // cold fallow
    { fill: '#635a3d', line: 'rgba(44,40,24,0.5)', spacing: 8 }     // stubble
  ];
  for (let i = 0; i < 26; i++) {
    const cx = rng() * S, cy = rng() * S;
    const w = (30 + rng() * 90) * px, h = (22 + rng() * 60) * px, rot = rng() * Math.PI;
    const t = fieldTypes[(rng() * fieldTypes.length) | 0];
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.fillStyle = t.fill;
    ctx.globalAlpha = 0.75 + rng() * 0.2;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    // Plow / crop lines
    ctx.strokeStyle = t.line;
    ctx.lineWidth = 2;
    for (let yy = -h / 2 + t.spacing; yy < h / 2; yy += t.spacing) {
      ctx.beginPath(); ctx.moveTo(-w / 2, yy); ctx.lineTo(w / 2, yy); ctx.stroke();
    }
    // Hedgerow border
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#26301e';
    ctx.lineWidth = 7;
    ctx.strokeRect(-w / 2, -h / 2, w, h);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#1c2415';
    ctx.strokeRect(-w / 2, -h / 2, w, h);
    ctx.restore();
  }

  // Large soft blotches
  const blotchColors = ['#55603a', '#333d24', '#55503a', '#2f3820', '#5d5a41', '#49543a'];
  for (let i = 0; i < 800; i++) {
    const x = rng() * S, y = rng() * S, r = 18 + rng() * 130;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const col = blotchColors[(rng() * blotchColors.length) | 0];
    g.addColorStop(0, col + 'cc');
    g.addColorStop(1, col + '00');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  // Speckle
  for (let i = 0; i < 5200; i++) {
    ctx.fillStyle = rng() > 0.5 ? 'rgba(20,24,14,0.35)' : 'rgba(120,124,92,0.28)';
    const s = 1 + rng() * 3.4;
    ctx.fillRect(rng() * S, rng() * S, s, s);
  }
  // Frost streaks
  ctx.globalAlpha = 0.16;
  for (let i = 0; i < 260; i++) {
    ctx.strokeStyle = rng() > 0.5 ? '#8a8564' : '#2c3320';
    ctx.lineWidth = 1 + rng() * 2;
    const x = rng() * S, y = rng() * S, a = rng() * Math.PI, len = 14 + rng() * 60;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const w2p = (x, z) => [ (x + MAP_SIZE / 2) * px, (z + MAP_SIZE / 2) * px ];

  // Roads — border then surface for each spoke
  for (const road of ROADS) {
    const drawRoad = (widthPx, style) => {
      ctx.strokeStyle = style; ctx.lineWidth = widthPx; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.beginPath();
      road.forEach((p, i) => {
        const [x, y] = w2p(p.x, p.z);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
    };
    drawRoad(52, 'rgba(38,34,25,0.95)');
    drawRoad(38, '#57503f');
    // Wheel ruts
    ctx.setLineDash([26, 20]);
    ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(46,41,31,0.6)';
    for (const off of [-11, 11]) {
      ctx.beginPath();
      road.forEach((p, i) => {
        const next = road[Math.min(i + 1, road.length - 1)];
        const prev = road[Math.max(i - 1, 0)];
        const dx = next.x - prev.x, dz = next.z - prev.z, len = Math.hypot(dx, dz) || 1;
        const [x, y] = w2p(p.x - (dz / len) * (off / px), p.z + (dx / len) * (off / px));
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }
  // Base aprons
  for (const base of Object.values(BASES)) {
    const [bx, by] = w2p(base.x, base.z);
    const g = ctx.createRadialGradient(bx, by, 10, bx, by, 26 * px);
    g.addColorStop(0, 'rgba(88,80,64,0.95)');
    g.addColorStop(0.72, 'rgba(80,74,58,0.55)');
    g.addColorStop(1, 'rgba(80,74,58,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(bx, by, 26 * px, 0, Math.PI * 2); ctx.fill();
  }
  // Craters around the midfield ring
  for (let i = 0; i < 22; i++) {
    const a = rng() * Math.PI * 2, d = 20 + rng() * 85;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    const [cx, cy] = w2p(x, z);
    const r = (1.2 + rng() * 2.4) * px;
    ctx.fillStyle = 'rgba(30,27,20,0.78)';
    ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.8, rng() * 3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(96,90,70,0.5)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(cx, cy, r * 1.15, r * 0.95, rng() * 3, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// ---------- Minimap base ----------
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
      const t = clamp((h - 1.6) / 12, 0, 1);
      r = lerp(56, 122, t); g = lerp(66, 116, t); b = lerp(38, 92, t);
      if (rd < 3.4) { r = 92; g = 84; b = 66; }
      const i = (py * S + px2) * 4;
      img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// ---------- Faction insignia / flag textures ----------
export function drawInsignia(ctx, kind, cx, cy, R, fg, stroke) {
  if (kind === 'star') {
    ctx.fillStyle = fg;
    ctx.beginPath();
    const r = R * 0.42;
    for (let i = 0; i < 10; i++) {
      const ang = -Math.PI / 2 + (i * Math.PI) / 5, rad = i % 2 === 0 ? R : r;
      const x = cx + Math.cos(ang) * rad, y = cy + Math.sin(ang) * rad;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = R * 0.14; ctx.stroke(); }
  } else if (kind === 'soviet') {
    // Gold star with sickle arc (stylised)
    ctx.fillStyle = fg;
    ctx.beginPath();
    const r = R * 0.4;
    for (let i = 0; i < 10; i++) {
      const ang = -Math.PI / 2 + (i * Math.PI) / 5, rad = i % 2 === 0 ? R : r;
      const x = cx + Math.cos(ang) * rad, y = cy + Math.sin(ang) * rad;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = fg; ctx.lineWidth = R * 0.18;
    ctx.beginPath(); ctx.arc(cx, cy + R * 0.1, R * 0.52, Math.PI * 0.25, Math.PI * 1.15); ctx.stroke();
  } else if (kind === 'cross') {
    ctx.fillStyle = fg;
    ctx.fillRect(cx - R * 0.36, cy - R, R * 0.72, R * 2);
    ctx.fillRect(cx - R, cy - R * 0.36, R * 2, R * 0.72);
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = R * 0.14; ctx.strokeRect(cx - R * 0.36, cy - R, R * 0.72, R * 2); ctx.strokeRect(cx - R, cy - R * 0.36, R * 2, R * 0.72); }
  } else if (kind === 'sun') {
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.82, 0, Math.PI * 2); ctx.fill();
  } else if (kind === 'lorraine') {
    // Cross of Lorraine — double-barred cross
    ctx.fillStyle = fg;
    ctx.fillRect(cx - R * 0.2, cy - R, R * 0.4, R * 2);
    ctx.fillRect(cx - R * 0.68, cy - R * 0.62, R * 1.36, R * 0.3);
    ctx.fillRect(cx - R * 0.82, cy + R * 0.28, R * 1.64, R * 0.3);
  }
}
function simpleFlagTexture(kind, bg, fg, stroke) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 128, 128);
  drawInsignia(ctx, kind, 64, 64, 46, fg, stroke);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
// National colour swatch for HUD badge (dataURL drawn on the fly — small)
export function paintFlagCanvas(canvas, faction) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  switch (faction) {
    case 'usa':
      for (let i = 0; i < 13; i++) { ctx.fillStyle = i % 2 ? '#ece8d8' : '#a02334'; ctx.fillRect(0, (i * h) / 13, w, h / 13 + 1); }
      ctx.fillStyle = '#2a3a5a'; ctx.fillRect(0, 0, w * 0.42, h * 0.54);
      drawInsignia(ctx, 'star', w * 0.21, h * 0.27, h * 0.17, '#ece8d8', null);
      break;
    case 'france':
      ctx.fillStyle = '#2a3a6a'; ctx.fillRect(0, 0, w / 3, h);
      ctx.fillStyle = '#ece8d8'; ctx.fillRect(w / 3, 0, w / 3, h);
      ctx.fillStyle = '#a02334'; ctx.fillRect((w / 3) * 2, 0, w / 3 + 1, h);
      break;
    case 'germany':
      ctx.fillStyle = '#1a1a1a'; ctx.fillRect(0, 0, w, h / 3);
      ctx.fillStyle = '#ece8d8'; ctx.fillRect(0, h / 3, w, h / 3);
      ctx.fillStyle = '#a02334'; ctx.fillRect(0, (h / 3) * 2, w, h / 3 + 1);
      break;
    case 'japan':
      ctx.fillStyle = '#ece8d8'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#bc002d'; ctx.beginPath(); ctx.arc(w / 2, h / 2, h * 0.3, 0, Math.PI * 2); ctx.fill();
      break;
    case 'ussr':
      ctx.fillStyle = '#9e2018'; ctx.fillRect(0, 0, w, h);
      drawInsignia(ctx, 'soviet', w * 0.22, h * 0.3, h * 0.18, '#d8c25a', null);
      break;
  }
}
export const factionFlagTexture = { neutral: null, usa: null, ussr: null, germany: null, japan: null, france: null };
export function getFlagTexture(owner) {
  if (!factionFlagTexture[owner]) {
    if (owner === 'neutral') factionFlagTexture[owner] = simpleFlagTexture('cross', '#e8e6da', '#6a6a62', null);
    else if (owner === 'usa') factionFlagTexture[owner] = simpleFlagTexture('star', '#4c5133', '#ece8d8', '#2a2c1e');
    else if (owner === 'ussr') factionFlagTexture[owner] = simpleFlagTexture('soviet', '#9e2018', '#d8c25a', null);
    else if (owner === 'germany') factionFlagTexture[owner] = simpleFlagTexture('cross', '#4a4f57', '#e6e3d8', '#151515');
    else if (owner === 'japan') factionFlagTexture[owner] = simpleFlagTexture('sun', '#e8e6da', '#bc002d', null);
    else if (owner === 'france') factionFlagTexture[owner] = simpleFlagTexture('lorraine', '#2a3a6a', '#e6e3d8', null);
  }
  return factionFlagTexture[owner];
}

// ---------- World ----------
export function buildWorld(scene) {
  const world = new THREE.Group();
  scene.add(world);

  // Terrain
  const segs = 176;
  const geo = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE, segs, segs);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, terrainHeight(x, z));
  }
  geo.computeVertexNormals();
  const groundTex = bakeGroundTexture();
  const terrain = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: groundTex }));
  terrain.receiveShadow = true;
  terrain.name = 'terrain';
  world.add(terrain);

  const rng = mulberry32(1337);

  // ---- Forests (instanced pines) ----
  const treePositions = [];
  let attempts = 0;
  while (treePositions.length < 330 && attempts < 6000) {
    attempts++;
    const x = (rng() - 0.5) * (MAP_SIZE - 26);
    const z = (rng() - 0.5) * (MAP_SIZE - 26);
    let blocked = false;
    for (const zone of FLAT_ZONES) if (Math.hypot(x - zone.x, z - zone.z) < zone.r + 2.5) { blocked = true; break; }
    if (!blocked && distToRoad(x, z) < 5.5) blocked = true;
    if (blocked) continue;
    const clump = fbm(x * 0.03 + 40, z * 0.03 + 9, 3);
    if (clump < 0.5 && rng() > 0.18) continue;
    treePositions.push({ x, z, s: 0.72 + rng() * 0.95, rot: rng() * Math.PI * 2 });
  }
  const trunkGeo = new THREE.CylinderGeometry(0.24, 0.34, 1.8, 5);
  const canopyGeo = new THREE.ConeGeometry(1.6, 3.7, 6);
  const canopy2Geo = new THREE.ConeGeometry(1.08, 2.5, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x38301f });
  const canopyMat = new THREE.MeshLambertMaterial({ color: 0x2e4630 });
  const canopy2Mat = new THREE.MeshLambertMaterial({ color: 0x39503c });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treePositions.length);
  const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, treePositions.length);
  const canopies2 = new THREE.InstancedMesh(canopy2Geo, canopy2Mat, treePositions.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const eul = new THREE.Euler();
  treePositions.forEach((t, i) => {
    const y = terrainHeight(t.x, t.z);
    q.setFromAxisAngle(up, t.rot);
    sc.set(t.s, t.s, t.s);
    p.set(t.x, y + 0.9 * t.s, t.z); m.compose(p, q, sc); trunks.setMatrixAt(i, m);
    p.set(t.x, y + (1.8 + 1.55) * t.s, t.z); m.compose(p, q, sc); canopies.setMatrixAt(i, m);
    p.set(t.x, y + (1.8 + 3.2) * t.s, t.z); m.compose(p, q, sc); canopies2.setMatrixAt(i, m);
  });
  trunks.castShadow = canopies.castShadow = canopies2.castShadow = true;
  world.add(trunks, canopies, canopies2);

  // ---- Hedgerows (Ardennes bocage — long dark bushes between fields) ----
  const hedgeGeo = new THREE.BoxGeometry(13, 1.35, 1.15);
  const hedgeMat = new THREE.MeshLambertMaterial({ color: 0x27331f });
  const hedges = new THREE.InstancedMesh(hedgeGeo, hedgeMat, 52);
  let placed = 0, hAttempts = 0;
  while (placed < 52 && hAttempts < 2000) {
    hAttempts++;
    const x = (rng() - 0.5) * (MAP_SIZE - 40), z = (rng() - 0.5) * (MAP_SIZE - 40);
    let bad = false;
    for (const zone of FLAT_ZONES) if (Math.hypot(x - zone.x, z - zone.z) < zone.r + 4) { bad = true; break; }
    if (!bad && distToRoad(x, z) < 6) bad = true;
    if (bad) continue;
    const y = terrainHeight(x, z);
    eul.set(0, rng() * Math.PI, 0);
    q.setFromEuler(eul);
    const len = 0.75 + rng() * 0.8;
    sc.set(len, 0.8 + rng() * 0.5, 1);
    p.set(x, y + 0.55 * sc.y, z);
    m.compose(p, q, sc);
    hedges.setMatrixAt(placed, m);
    placed++;
  }
  hedges.count = placed;
  hedges.castShadow = true;
  world.add(hedges);

  // ---- Rocks ----
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  const rockMat = new THREE.MeshLambertMaterial({ color: 0x6b6a63, flatShading: true });
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, 110);
  for (let i = 0; i < 110; i++) {
    const x = (rng() - 0.5) * (MAP_SIZE - 22), z = (rng() - 0.5) * (MAP_SIZE - 22);
    const y = terrainHeight(x, z);
    const s = 0.35 + rng() * 1.25;
    eul.set(rng() * 3, rng() * 3, rng() * 3);
    q.setFromEuler(eul);
    sc.set(s, s * (0.55 + rng() * 0.5), s);
    p.set(x, y + s * 0.2, z);
    m.compose(p, q, sc);
    rocks.setMatrixAt(i, m);
  }
  rocks.castShadow = true;
  world.add(rocks);

  // ---- Clouds ----
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
  for (let i = 0; i < 16; i++) {
    const mat = new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.5 + rng() * 0.32, depthWrite: false });
    const sp = new THREE.Sprite(mat);
    sp.position.set((rng() - 0.5) * 520, 60 + rng() * 34, (rng() - 0.5) * 520);
    const s = 46 + rng() * 52;
    sp.scale.set(s, s * 0.6, 1);
    sp.userData.drift = 0.5 + rng() * 0.7;
    world.add(sp);
    clouds.push(sp);
  }

  // ---- Midfield craters (visual) ----
  const craterMat = new THREE.MeshBasicMaterial({ color: 0x211d15, transparent: true, opacity: 0.55, depthWrite: false });
  for (let i = 0; i < 26; i++) {
    const a = rng() * Math.PI * 2, d = 15 + rng() * 80;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    const r = 0.8 + rng() * 1.7;
    const cg = new THREE.CircleGeometry(r, 10);
    cg.rotateX(-Math.PI / 2);
    const cm = new THREE.Mesh(cg, craterMat);
    cm.position.set(x, terrainHeight(x, z) + 0.06, z);
    world.add(cm);
  }

  // ---- Capture flags ----
  const flags = CAPTURE_POINTS.map((cp) => {
    const g = new THREE.Group();
    const y = terrainHeight(cp.x, cp.z);
    g.position.set(cp.x, y, cp.z);
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.2, 4.8, 6),
      new THREE.MeshLambertMaterial({ color: 0x5c5142 })
    );
    pole.position.y = 2.4; pole.castShadow = true;
    g.add(pole);
    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), new THREE.MeshLambertMaterial({ color: 0x8f7a3a, emissive: 0x241a05 }));
    finial.position.y = 4.9;
    g.add(finial);
    const clothGeo = new THREE.PlaneGeometry(2.2, 1.35, 10, 5);
    clothGeo.translate(1.1, 0, 0);
    const clothMat = new THREE.MeshLambertMaterial({ map: getFlagTexture('neutral'), side: THREE.DoubleSide, emissive: 0x111111 });
    const cloth = new THREE.Mesh(clothGeo, clothMat);
    cloth.position.set(0.15, 4.0, 0);
    g.add(cloth);
    const ringGeo = new THREE.RingGeometry(7.6, 8.5, 40);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xd8d5c8, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.09;
    g.add(ring);
    world.add(g);
    return {
      id: cp.id, label: cp.label, x: cp.x, z: cp.z,
      owner: 'neutral', progress: 0, capturingFaction: null,
      group: g, cloth, ring, ringMat, clothMat, baseY: y
    };
  });

  // ---- Props near bases: crates & barrels ----
  const crateMat = new THREE.MeshLambertMaterial({ color: 0x4f4429 });
  const barrelMat = new THREE.MeshLambertMaterial({ color: 0x35402e });
  for (const base of Object.values(BASES)) {
    for (let i = 0; i < 12; i++) {
      const a = rng() * Math.PI * 2, d = 5 + rng() * 13;
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
