import * as THREE from 'three';
import { mulberry32, tileNoise, tileFbm, clamp } from './noise.js';

function canvas2d(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  return { canvas, ctx };
}

function texture(canvas, { srgb = true, repeat = null, aniso = 8 } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = aniso;
  if (repeat) tex.repeat.set(repeat[0], repeat[1]);
  tex.needsUpdate = true;
  return tex;
}

function makePuff() {
  const size = 128;
  const { canvas, ctx } = canvas2d(size, size);
  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.2, 'rgba(255,255,255,.75)');
  grad.addColorStop(0.55, 'rgba(255,255,255,.18)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return texture(canvas, { srgb: false, aniso: 2 });
}

function makeShadowTexture() {
  const { canvas, ctx } = canvas2d(128, 128);
  const grad = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
  grad.addColorStop(0, 'rgba(0,0,0,.72)');
  grad.addColorStop(0.35, 'rgba(0,0,0,.48)');
  grad.addColorStop(0.72, 'rgba(0,0,0,.12)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  return texture(canvas, { srgb: false, aniso: 2 });
}

function makeWoodTexture() {
  const w = 512;
  const h = 512;
  const { canvas, ctx } = canvas2d(w, h);
  const random = mulberry32(551);
  ctx.fillStyle = '#594633';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) {
    const y = random() * h;
    ctx.beginPath();
    ctx.strokeStyle = `rgba(${20 + random() * 35},${13 + random() * 26},${8 + random() * 18},${0.12 + random() * 0.35})`;
    ctx.lineWidth = 0.6 + random() * 2.4;
    ctx.moveTo(0, y);
    for (let x = 0; x <= w; x += 18) {
      ctx.lineTo(x, y + Math.sin(x * 0.025 + i) * 3 + (random() - 0.5) * 2);
    }
    ctx.stroke();
  }
  for (let i = 0; i < 18; i++) {
    const x = random() * w;
    const y = random() * h;
    ctx.strokeStyle = 'rgba(24,15,9,.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, y, 5 + random() * 14, 2 + random() * 4, random() * Math.PI, 0, Math.PI * 2);
    ctx.stroke();
  }
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(255,230,175,.12)');
  grad.addColorStop(1, 'rgba(0,0,0,.1)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  return texture(canvas, { repeat: [2, 1] });
}

function makeBarkMaps(birch = false) {
  const w = 256;
  const h = 512;
  const { canvas, ctx } = canvas2d(w, h);
  const random = mulberry32(birch ? 418 : 991);
  const bump = canvas2d(w, h);
  const bctx = bump.ctx;
  const img = ctx.createImageData(w, h);
  const bimg = bctx.createImageData(w, h);

  for (let y = 0; y < h; y++) {
    const v = y / h;
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const n = tileFbm(u * 5, v * 8, 5, 4) * 0.5 + 0.5;
      const fine = tileNoise(u * 32, v * 54, 32) * 0.5 + 0.5;
      const vertical = Math.sin(u * Math.PI * 2 * 14 + n * 4) * 0.5 + 0.5;
      let r, g, b;
      if (birch) {
        const lenticel = Math.pow(clamp(Math.sin(v * 200 + n * 5) * 0.5 + 0.5, 0, 1), 18);
        const patch = clamp((n - 0.52) * 2.8, 0, 1);
        r = 190 + n * 45 - patch * 50;
        g = 184 + n * 44 - patch * 55;
        b = 160 + n * 38 - patch * 65;
        r -= lenticel * 115;
        g -= lenticel * 118;
        b -= lenticel * 112;
        r += fine * 11;
        g += fine * 10;
        b += fine * 8;
        if (patch > 0.6) {
          r -= 25;
          g -= 12;
          b -= 8;
        }
      } else {
        r = 48 + n * 44 + vertical * 15 + fine * 16;
        g = 38 + n * 34 + vertical * 10 + fine * 13;
        b = 27 + n * 24 + vertical * 7 + fine * 10;
      }
      const k = (y * w + x) * 4;
      img.data[k] = clamp(r, 0, 255);
      img.data[k + 1] = clamp(g, 0, 255);
      img.data[k + 2] = clamp(b, 0, 255);
      img.data[k + 3] = 255;
      const height = clamp((n * 0.55 + fine * 0.15 + vertical * 0.3) * 255, 0, 255);
      bimg.data[k] = height;
      bimg.data[k + 1] = height;
      bimg.data[k + 2] = height;
      bimg.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  bctx.putImageData(bimg, 0, 0);

  if (!birch) {
    // Deep, wandering fissures.
    for (let i = 0; i < 30; i++) {
      let x = random() * w;
      const y0 = random() * h;
      ctx.beginPath();
      ctx.strokeStyle = `rgba(18,12,7,${0.25 + random() * 0.35})`;
      ctx.lineWidth = 1 + random() * 2.6;
      bctx.strokeStyle = 'rgba(20,20,20,.55)';
      bctx.lineWidth = 2;
      ctx.moveTo(x, y0);
      bctx.moveTo(x, y0);
      for (let y = y0; y < y0 + 80 + random() * 180; y += 8) {
        x += (random() - 0.5) * 5;
        ctx.lineTo(x, y);
        bctx.lineTo(x, y);
      }
      ctx.stroke();
      bctx.stroke();
    }
  } else {
    for (let i = 0; i < 30; i++) {
      const y = random() * h;
      const x = random() * w;
      ctx.fillStyle = `rgba(35,35,30,${0.18 + random() * 0.3})`;
      ctx.beginPath();
      ctx.ellipse(x, y, 3 + random() * 12, 1 + random() * 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const color = texture(canvas, { repeat: [2, 3] });
  const bumpMap = texture(bump.canvas, { srgb: false, repeat: [2, 3] });
  return { color, bump: bumpMap };
}

function makeGroundMaps() {
  const size = 512;
  const { canvas, ctx } = canvas2d(size, size);
  const img = ctx.createImageData(size, size);
  const heights = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const large = tileFbm(u * 5, v * 5, 5, 5) * 0.5 + 0.5;
      const fine = tileNoise(u * 58, v * 58, 58) * 0.5 + 0.5;
      const grit = tileNoise(u * 150, v * 150, 150) * 0.5 + 0.5;
      const moss = Math.pow(tileFbm(u * 9 + 4, v * 9, 4, 8) * 0.5 + 0.5, 2.2);
      let r = 72 + large * 50 + fine * 23 + grit * 11;
      let g = 73 + large * 58 + fine * 24 + grit * 10;
      let b = 44 + large * 35 + fine * 18 + grit * 9;
      r += moss * 24;
      g += moss * 32;
      b += moss * 11;
      if (large < 0.28) {
        r -= 22;
        g -= 18;
        b -= 12;
      }
      const k = (y * size + x) * 4;
      img.data[k] = clamp(r, 0, 255);
      img.data[k + 1] = clamp(g, 0, 255);
      img.data[k + 2] = clamp(b, 0, 255);
      img.data[k + 3] = 255;
      heights[y * size + x] = large * 0.66 + fine * 0.24 + grit * 0.1;
    }
  }
  ctx.putImageData(img, 0, 0);

  // Tiny fallen leaves and twigs in the litter.
  const random = mulberry32(2224);
  for (let i = 0; i < 1900; i++) {
    const x = random() * size;
    const y = random() * size;
    const a = random() * Math.PI;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.fillStyle = `rgba(${80 + random() * 60},${50 + random() * 35},${25 + random() * 20},${0.1 + random() * 0.32})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, 1 + random() * 3.2, 0.5 + random() * 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  for (let i = 0; i < 70; i++) {
    let x = random() * size;
    let y = random() * size;
    ctx.strokeStyle = `rgba(${38 + random() * 22},${28 + random() * 16},${18 + random() * 12},${0.16 + random() * 0.3})`;
    ctx.lineWidth = 0.8 + random() * 1.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 8; s++) {
      x += (random() - 0.5) * 8;
      y += random() * 5;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  const normal = canvas2d(size, size);
  const nimg = normal.ctx.createImageData(size, size);
  const strength = 2.1;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const l = heights[y * size + ((x - 1 + size) % size)];
      const r = heights[y * size + ((x + 1) % size)];
      const u = heights[((y - 1 + size) % size) * size + x];
      const d = heights[((y + 1) % size) * size + x];
      let nx = (l - r) * strength;
      let ny = (u - d) * strength;
      const nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len;
      ny /= len;
      const k = (y * size + x) * 4;
      nimg.data[k] = (nx * 0.5 + 0.5) * 255;
      nimg.data[k + 1] = (ny * 0.5 + 0.5) * 255;
      nimg.data[k + 2] = (nz / len * 0.5 + 0.5) * 255;
      nimg.data[k + 3] = 255;
    }
  }
  normal.ctx.putImageData(nimg, 0, 0);

  return {
    map: texture(canvas, { repeat: [28, 28] }),
    normalMap: texture(normal.canvas, { srgb: false, repeat: [28, 28] }),
  };
}

function makeStoneMaps() {
  const size = 512;
  const { canvas, ctx } = canvas2d(size, size);
  const bump = canvas2d(size, size);
  const img = ctx.createImageData(size, size);
  const bimg = bump.ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const n = tileFbm(u * 4, v * 4, 5, 5) * 0.5 + 0.5;
      const cracks = Math.pow(1 - Math.abs(tileNoise(u * 12, v * 12, 12)), 8);
      const grain = tileNoise(u * 70, v * 70, 70) * 0.5 + 0.5;
      const moss = Math.pow(tileFbm(u * 8 + 20, v * 8, 4, 9) * 0.5 + 0.5, 2.5) * (0.4 + v * 0.6);
      let r = 102 + n * 62 + grain * 18 - cracks * 45;
      let g = 101 + n * 58 + grain * 16 - cracks * 48;
      let b = 91 + n * 48 + grain * 13 - cracks * 38;
      r -= moss * 42;
      g -= moss * 24;
      b -= moss * 48;
      const k = (y * size + x) * 4;
      img.data[k] = clamp(r, 0, 255);
      img.data[k + 1] = clamp(g, 0, 255);
      img.data[k + 2] = clamp(b, 0, 255);
      img.data[k + 3] = 255;
      const hgt = clamp((n * 0.7 + grain * 0.2 - cracks * 0.35) * 255, 0, 255);
      bimg.data[k] = hgt;
      bimg.data[k + 1] = hgt;
      bimg.data[k + 2] = hgt;
      bimg.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  bump.ctx.putImageData(bimg, 0, 0);
  return {
    map: texture(canvas, { repeat: [2, 2] }),
    bump: texture(bump.canvas, { srgb: false, repeat: [2, 2] }),
  };
}

function makeGrass() {
  const size = 512;
  const { canvas, ctx } = canvas2d(size, size);
  const random = mulberry32(712);
  ctx.clearRect(0, 0, size, size);
  for (let i = 0; i < 46; i++) {
    const baseX = 246 + (random() - 0.5) * 38;
    const height = 220 + random() * 270;
    const topX = baseX + (random() - 0.5) * 130;
    const topY = 500 - height;
    const width = 2.5 + random() * 5;
    const bend = (random() - 0.5) * 36;
    const shade = 45 + random() * 70;
    ctx.beginPath();
    ctx.moveTo(baseX - width, 510);
    ctx.quadraticCurveTo(baseX + bend, 510 - height * 0.5, topX, topY);
    ctx.quadraticCurveTo(baseX + bend + width, 510 - height * 0.5, baseX + width, 510);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 510, 0, topY);
    grad.addColorStop(0, `rgb(${28 + shade * 0.2},${38 + shade * 0.35},${18 + shade * 0.18})`);
    grad.addColorStop(0.65, `rgb(${42 + shade * 0.4},${58 + shade * 0.55},${25 + shade * 0.25})`);
    grad.addColorStop(1, `rgb(${74 + shade * 0.6},${87 + shade * 0.55},${35 + shade * 0.28})`);
    ctx.fillStyle = grad;
    ctx.fill();
  }
  // A few dry seed heads.
  for (let i = 0; i < 8; i++) {
    ctx.strokeStyle = 'rgba(150,133,74,.7)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(256 + (random() - 0.5) * 20, 510);
    ctx.quadraticCurveTo(240 + random() * 30, 280, 210 + random() * 95, 150 + random() * 110);
    ctx.stroke();
  }
  return texture(canvas, { srgb: true, aniso: 8 });
}

function makeFern() {
  const size = 512;
  const { canvas, ctx } = canvas2d(size, size);
  const random = mulberry32(1904);
  ctx.clearRect(0, 0, size, size);
  const stemX = 256;
  const stemBottom = 508;
  const stemTop = 30;
  const stemGrad = ctx.createLinearGradient(0, 508, 0, 30);
  stemGrad.addColorStop(0, '#304621');
  stemGrad.addColorStop(1, '#6f8240');
  ctx.strokeStyle = stemGrad;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(stemX, stemBottom);
  ctx.bezierCurveTo(238, 380, 278, 180, 256, stemTop);
  ctx.stroke();

  const pairs = 17;
  for (let i = 0; i < pairs; i++) {
    const t = i / (pairs - 1);
    const y = stemBottom - t * (stemBottom - stemTop - 16);
    const cx = 256 + Math.sin(t * 3.3) * 18 - t * 8;
    const len = (1 - t * 0.8) * 170 + 22;
    const droop = 18 + t * 20;
    for (const side of [-1, 1]) {
      const tipX = cx + side * len;
      const tipY = y - 6 - droop * (0.3 + t);
      ctx.save();
      ctx.translate(cx, y);
      ctx.rotate((side * (0.28 + t * 0.25)) + (random() - 0.5) * 0.05);
      const grad = ctx.createLinearGradient(0, 0, side * len, -droop);
      grad.addColorStop(0, 'rgba(49,75,31,.96)');
      grad.addColorStop(0.55, 'rgba(70,101,41,.96)');
      grad.addColorStop(1, 'rgba(113,139,66,.92)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(side * len * 0.45, -7, side * len, -droop);
      ctx.quadraticCurveTo(side * len * 0.48, 8, 0, 3);
      ctx.closePath();
      ctx.fill();
      // Pinnate cuts.
      ctx.strokeStyle = 'rgba(31,52,21,.55)';
      ctx.lineWidth = 1.1;
      for (let s = 0.16; s < 0.92; s += 0.11) {
        ctx.beginPath();
        ctx.moveTo(side * len * s, -droop * s - 1);
        ctx.lineTo(side * len * s, 2 - droop * s * 0.2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  return texture(canvas, { srgb: true, aniso: 8 });
}

function makePineCanopy() {
  const w = 768;
  const h = 1024;
  const { canvas, ctx } = canvas2d(w, h);
  const random = mulberry32(8321);
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2;
  ctx.strokeStyle = '#2b291d';
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(cx, h - 12);
  ctx.lineTo(cx + 5, 20);
  ctx.stroke();

  const tiers = 28;
  for (let i = 0; i < tiers; i++) {
    const t = i / (tiers - 1);
    const y = 36 + t * (h - 80);
    const spread = (0.08 + Math.pow(t, 0.86) * 0.87) * w * 0.47;
    const branches = 2 + (random() > 0.58 ? 1 : 0);
    for (let side = -1; side <= 1; side += 2) {
      for (let b = 0; b < branches; b++) {
        const yy = y + (b - branches * 0.5) * 12;
        const angle = side * (0.04 + random() * 0.24) + (t - 0.5) * 0.09;
        const len = spread * (0.68 + random() * 0.32);
        const tipX = cx + side * len * Math.cos(angle);
        const tipY = yy + len * Math.sin(angle) + len * 0.15;
        ctx.strokeStyle = 'rgba(37,39,25,.9)';
        ctx.lineWidth = 3.4 - t * 1.7;
        ctx.beginPath();
        ctx.moveTo(cx, yy);
        ctx.quadraticCurveTo(cx + side * len * 0.45, yy - 3, tipX, tipY);
        ctx.stroke();

        // Needle clusters along each branch.
        const needles = 34;
        for (let n = 0; n < needles; n++) {
          const p = 0.18 + random() * 0.88;
          const px = cx + (tipX - cx) * p;
          const py = yy + (tipY - yy) * p + Math.sin(p * Math.PI) * 7;
          const outward = side * (5 + random() * 15);
          const up = -4 - random() * 13;
          const shade = 38 + random() * 67;
          ctx.strokeStyle = `rgb(${22 + shade * 0.3},${40 + shade * 0.57},${25 + shade * 0.27})`;
          ctx.lineWidth = 1.2 + random() * 1.2;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px + outward * 0.75, py + up);
          ctx.stroke();
          if (random() > 0.48) {
            ctx.strokeStyle = `rgba(${101 + random() * 43},${114 + random() * 35},${53 + random() * 22},.64)`;
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(px + outward * 0.5, py + up * 0.7 - 4);
            ctx.stroke();
          }
        }
      }
    }
  }

  // Soft internal shadow beneath the canopy.
  const shade = ctx.createLinearGradient(0, h, 0, 0);
  shade.addColorStop(0, 'rgba(3,10,6,.26)');
  shade.addColorStop(0.55, 'rgba(4,12,7,.04)');
  shade.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, w, h);
  return texture(canvas, { srgb: true, aniso: 8 });
}

function makeLeafCanopy(seed, options = {}) {
  const w = 1024;
  const h = 1024;
  const { canvas, ctx } = canvas2d(w, h);
  const random = mulberry32(seed);
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2;
  const baseY = h - 24;
  const trunkTop = h * 0.56;
  ctx.strokeStyle = options.birch ? '#5a5b47' : '#3a2d1e';
  ctx.lineWidth = options.birch ? 10 : 18;
  ctx.beginPath();
  ctx.moveTo(cx, baseY);
  ctx.lineTo(cx + 4, trunkTop + 40);
  ctx.stroke();

  const branches = [];
  const count = options.birch ? 12 : 18;
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const startY = trunkTop + 35 + t * (h * 0.32);
    const side = i % 2 ? 1 : -1;
    const len = (w * 0.38) * (1 - t * 0.55) * (0.7 + random() * 0.45);
    const endX = cx + side * len;
    const endY = startY - len * (0.36 + random() * 0.35);
    ctx.strokeStyle = options.birch ? 'rgba(68,64,48,.85)' : 'rgba(42,31,20,.9)';
    ctx.lineWidth = Math.max(2, 9 - t * 6);
    ctx.beginPath();
    ctx.moveTo(cx, startY);
    ctx.quadraticCurveTo(cx + side * len * 0.5, startY - 8, endX, endY);
    ctx.stroke();
    branches.push({ x: endX, y: endY, r: 0.13 + random() * 0.12 });
    // A couple of fork tips.
    for (let f = 0; f < 3; f++) {
      branches.push({
        x: endX + (random() - 0.5) * 170,
        y: endY + (random() - 0.5) * 150 - 35,
        r: 0.08 + random() * 0.12,
      });
    }
  }

  const leafPalette = options.birch
    ? [[82, 112, 48], [112, 137, 62], [139, 154, 73], [165, 168, 84], [76, 99, 45], [188, 173, 84]]
    : [[34, 57, 33], [47, 76, 40], [56, 88, 43], [72, 104, 50], [93, 117, 55], [110, 125, 61], [137, 138, 67]];

  const leafCount = options.birch ? 4500 : 6500;
  for (let i = 0; i < leafCount; i++) {
    const b = branches[Math.floor(random() * branches.length)];
    const angle = random() * Math.PI * 2;
    const rad = Math.pow(random(), 1.7) * b.r * w;
    const x = b.x + Math.cos(angle) * rad * 1.2;
    const y = b.y + Math.sin(angle) * rad * 0.78;
    const crown = Math.hypot((x - cx) / (w * 0.47), (y - h * 0.36) / (h * 0.42));
    if (crown > 1.08 || x < 10 || x > w - 10 || y < 12 || y > h - 8) continue;
    const pal = leafPalette[Math.floor(random() * leafPalette.length)];
    const light = (1 - Math.min(1, crown)) * 0.18 + random() * 0.2;
    const r = clamp(pal[0] + light * 105, 0, 255);
    const g = clamp(pal[1] + light * 100, 0, 255);
    const bcol = clamp(pal[2] + light * 58, 0, 255);
    ctx.fillStyle = `rgba(${r},${g},${bcol},${options.birch ? 0.8 + random() * 0.2 : 0.75 + random() * 0.25})`;
    ctx.beginPath();
    const rr = 1.1 + random() * 3.5;
    ctx.ellipse(x, y, rr, rr * (0.45 + random() * 0.35), random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  // Warm rim light on the upper-left edge.
  for (let i = 0; i < 1000; i++) {
    const angle = random() * Math.PI * 2;
    const rad = 180 + random() * 330;
    const x = cx + Math.cos(angle) * rad;
    const y = h * 0.36 + Math.sin(angle) * rad * 0.7;
    const crown = Math.hypot((x - cx) / (w * 0.47), (y - h * 0.36) / (h * 0.42));
    if (crown < 0.64 || crown > 1.03) continue;
    ctx.fillStyle = `rgba(${155 + random() * 45},${143 + random() * 35},${76 + random() * 30},${0.18 + random() * 0.3})`;
    ctx.beginPath();
    ctx.ellipse(x, y, 1 + random() * 2.3, 0.8 + random() * 1.4, random() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  return texture(canvas, { srgb: true, aniso: 8 });
}

function makeWaterNormal() {
  const size = 512;
  const { canvas, ctx } = canvas2d(size, size);
  const img = ctx.createImageData(size, size);
  const heights = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const n = tileFbm(u * 8, v * 8, 4, 8) * 0.5 + 0.5;
      const wave = Math.sin((u * 3 + v * 2) * Math.PI * 2) * 0.35 + Math.sin((u * 7 - v * 4) * Math.PI * 2) * 0.22;
      heights[y * size + x] = n * 0.55 + wave * 0.45;
    }
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const l = heights[y * size + ((x - 1 + size) % size)];
      const r = heights[y * size + ((x + 1) % size)];
      const u = heights[((y - 1 + size) % size) * size + x];
      const d = heights[((y + 1) % size) * size + x];
      let nx = (l - r) * 2.1;
      let ny = (u - d) * 2.1;
      const nz = 1;
      const len = Math.hypot(nx, ny, nz);
      const k = (y * size + x) * 4;
      img.data[k] = (nx / len * 0.5 + 0.5) * 255;
      img.data[k + 1] = (ny / len * 0.5 + 0.5) * 255;
      img.data[k + 2] = (nz / len * 0.5 + 0.5) * 255;
      img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return texture(canvas, { srgb: false, repeat: [9, 9], aniso: 8 });
}

function makeRuneTexture(kind = 'stone') {
  const size = 512;
  const { canvas, ctx } = canvas2d(size, size);
  ctx.clearRect(0, 0, size, size);
  const random = mulberry32(kind === 'ring' ? 88 : 122);
  ctx.strokeStyle = 'rgba(226,230,170,.92)';
  ctx.shadowColor = 'rgba(213,234,155,.9)';
  ctx.shadowBlur = 15;
  if (kind === 'ring') {
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(256, 256, 190, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(256, 256, 158, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      const x1 = 256 + Math.cos(a) * 160;
      const y1 = 256 + Math.sin(a) * 160;
      const x2 = 256 + Math.cos(a) * 188;
      const y2 = 256 + Math.sin(a) * 188;
      ctx.lineWidth = 1 + random() * 2;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2;
      ctx.save();
      ctx.translate(256 + Math.cos(a) * 112, 256 + Math.sin(a) * 112);
      ctx.rotate(a + Math.PI / 2);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.lineTo(10, 8);
      ctx.lineTo(-10, 8);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
  } else {
    ctx.lineWidth = 2.4;
    for (let i = 0; i < 9; i++) {
      const y = 70 + i * 42;
      ctx.beginPath();
      ctx.moveTo(190, y);
      ctx.lineTo(322, y);
      ctx.stroke();
      const glyph = Math.floor(random() * 4);
      ctx.beginPath();
      if (glyph === 0) {
        ctx.moveTo(256, y);
        ctx.lineTo(256, y + 28);
      } else if (glyph === 1) {
        ctx.moveTo(220, y + 20);
        ctx.lineTo(256, y + 7);
        ctx.lineTo(292, y + 20);
      } else if (glyph === 2) {
        ctx.arc(256, y + 15, 14, 0, Math.PI * 2);
      } else {
        ctx.moveTo(230, y + 9);
        ctx.lineTo(280, y + 27);
        ctx.moveTo(280, y + 9);
        ctx.lineTo(230, y + 27);
      }
      ctx.stroke();
    }
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(300, 58);
    ctx.lineTo(256, 24);
    ctx.lineTo(212, 58);
    ctx.stroke();
  }
  return texture(canvas, { srgb: true, aniso: 4 });
}

function makeLanternGlow() {
  const { canvas, ctx } = canvas2d(256, 256);
  const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255,240,180,1)');
  grad.addColorStop(0.08, 'rgba(255,214,120,.95)');
  grad.addColorStop(0.35, 'rgba(255,174,80,.3)');
  grad.addColorStop(1, 'rgba(255,154,50,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  return texture(canvas, { srgb: false });
}

export function createTextures() {
  return {
    puff: makePuff(),
    shadow: makeShadowTexture(),
    wood: makeWoodTexture(),
    bark: makeBarkMaps(false),
    birchBark: makeBarkMaps(true),
    ground: makeGroundMaps(),
    stone: makeStoneMaps(),
    grass: makeGrass(),
    fern: makeFern(),
    pine: makePineCanopy(),
    oak: makeLeafCanopy(3401),
    birchLeaves: makeLeafCanopy(7305, { birch: true }),
    waterNormal: makeWaterNormal(),
    runeStone: makeRuneTexture('stone'),
    runeRing: makeRuneTexture('ring'),
    glow: makeLanternGlow(),
  };
}
