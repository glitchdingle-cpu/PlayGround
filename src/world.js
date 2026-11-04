import { SECTORS, WORLD, FACTIONS } from './data.js';

function mulberry32(seed) {
  return function () {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;

const FIELD_COLORS = ['#777b58', '#82835d', '#6f7752', '#8d8760', '#737c54', '#948b64', '#7f855e', '#6d7250'];
const TREE_COLORS = ['#384a36', '#40513a', '#46583e', '#334631'];

function drawBlob(ctx, x, y, radius, color, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  const gradient = ctx.createRadialGradient(x, y, radius * 0.1, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, 'rgba(39,44,31,0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function fieldPolygon(ctx, x, y, w, h, rng, color) {
  const pad = 2;
  const points = [
    [x + rng() * 8, y + rng() * 8],
    [x + w - rng() * 8, y + rng() * 8],
    [x + w - rng() * 8, y + h - rng() * 8],
    [x + rng() * 8, y + h - rng() * 8]
  ];
  ctx.beginPath();
  points.forEach(([px, py], index) => {
    if (index === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.62;
  ctx.fill();
  ctx.globalAlpha = 0.34;
  ctx.strokeStyle = '#3f412e';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Plough lines, kept faint so the map feels painted rather than tiled.
  const rows = Math.max(2, Math.floor(h / 15));
  ctx.strokeStyle = 'rgba(56,55,38,.12)';
  ctx.lineWidth = 1;
  for (let row = 1; row < rows; row += 1) {
    const yy = y + (h / rows) * row;
    ctx.beginPath();
    ctx.moveTo(x + pad + rng() * 5, yy + rng() * 2);
    ctx.lineTo(x + w - pad - rng() * 5, yy + rng() * 2);
    ctx.stroke();
  }
}

function drawTree(ctx, x, y, size, rng) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(31,37,25,.24)';
  ctx.beginPath();
  ctx.ellipse(size * 0.32, size * 0.28, size * 0.85, size * 0.5, 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4b452e';
  ctx.fillRect(-1, -1, 2, size * 0.72);
  const color = TREE_COLORS[Math.floor(rng() * TREE_COLORS.length)];
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, -size * 0.25, size * 0.72, 0, Math.PI * 2);
  ctx.arc(-size * 0.45, 0, size * 0.5, 0, Math.PI * 2);
  ctx.arc(size * 0.42, 0.05, size * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(157,164,114,.18)';
  ctx.beginPath();
  ctx.arc(-size * 0.22, -size * 0.46, size * 0.32, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawRoad(ctx, points, width = 7) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const path = new Path2D();
  path.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length - 1; i += 1) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    path.quadraticCurveTo(x1, y1, (x1 + x2) / 2, (y1 + y2) / 2);
  }
  const last = points[points.length - 1];
  path.lineTo(last[0], last[1]);
  ctx.strokeStyle = 'rgba(37,36,26,.4)';
  ctx.lineWidth = width + 5;
  ctx.stroke(path);
  ctx.strokeStyle = '#b4a478';
  ctx.lineWidth = width;
  ctx.stroke(path);
  ctx.strokeStyle = 'rgba(241,222,174,.26)';
  ctx.lineWidth = 1.7;
  ctx.stroke(path);
  ctx.restore();
}

function drawRail(ctx, points) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const path = new Path2D();
  path.moveTo(points[0][0], points[0][1]);
  points.slice(1).forEach(([x, y]) => path.lineTo(x, y));
  ctx.strokeStyle = 'rgba(35,34,25,.55)';
  ctx.lineWidth = 8;
  ctx.stroke(path);
  ctx.strokeStyle = '#5c5745';
  ctx.lineWidth = 4.5;
  ctx.stroke(path);
  ctx.strokeStyle = 'rgba(214,201,164,.65)';
  ctx.lineWidth = 1.2;
  ctx.stroke(path);
  // Sleepers.
  for (let i = 0; i < points.length - 1; i += 1) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    const len = Math.hypot(x2 - x1, y2 - y1);
    const nx = -(y2 - y1) / len;
    const ny = (x2 - x1) / len;
    for (let d = 7; d < len; d += 14) {
      const x = lerp(x1, x2, d / len);
      const y = lerp(y1, y2, d / len);
      ctx.strokeStyle = 'rgba(54,50,37,.55)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x - nx * 5, y - ny * 5);
      ctx.lineTo(x + nx * 5, y + ny * 5);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function riverXAt(y, rng = Math.random) {
  // The Marne-Sambre line: a broad, slow curve between the western and central powers.
  return 1120 + Math.sin(y / 175) * 58 + Math.sin(y / 73 + 1.2) * 22 - (y / WORLD.h) * 95;
}

function buildRiverPoints() {
  const points = [];
  for (let y = -40; y <= WORLD.h + 40; y += 24) {
    points.push([riverXAt(y), y]);
  }
  return points;
}

export function createWorld() {
  const rng = mulberry32(19140907);
  const canvas = document.createElement('canvas');
  canvas.width = WORLD.w;
  canvas.height = WORLD.h;
  const ctx = canvas.getContext('2d');

  // Base ground and broad atmospheric washes.
  const base = ctx.createLinearGradient(0, 0, WORLD.w, WORLD.h);
  base.addColorStop(0, '#737a58');
  base.addColorStop(0.48, '#7b7d5b');
  base.addColorStop(1, '#666c4e');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);

  const washColors = ['#8d8a5d', '#5e674d', '#978e62', '#5f684e', '#7f7a55'];
  for (let i = 0; i < 60; i += 1) {
    drawBlob(ctx, rng() * WORLD.w, rng() * WORLD.h, 100 + rng() * 280, washColors[Math.floor(rng() * washColors.length)], 0.08);
  }

  // Open farmland, painted as irregular fields rather than a perfect grid.
  const cellW = 150;
  const cellH = 126;
  for (let y = -cellH; y < WORLD.h + cellH; y += cellH) {
    for (let x = -cellW; x < WORLD.w + cellW; x += cellW) {
      const color = FIELD_COLORS[Math.floor(rng() * FIELD_COLORS.length)];
      fieldPolygon(ctx, x + (rng() - 0.5) * 15, y + (rng() - 0.5) * 12, cellW - 3, cellH - 3, rng, color);
      if (rng() > 0.54) {
        ctx.strokeStyle = 'rgba(74,67,43,.18)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + cellW * 0.52, y + 10);
        ctx.lineTo(x + cellW * 0.5, y + cellH - 10);
        ctx.stroke();
      }
    }
  }

  // A few low ridge lines to break up the horizon.
  for (let i = 0; i < 16; i += 1) {
    const cx = rng() * WORLD.w;
    const cy = rng() * WORLD.h;
    const rx = 60 + rng() * 160;
    const ry = 24 + rng() * 50;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((rng() - 0.5) * 0.8);
    for (let r = 0; r < 3; r += 1) {
      ctx.strokeStyle = `rgba(53,57,38,${0.11 - r * 0.018})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, r * 12, rx + r * 18, ry + r * 6, 0, Math.PI, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Muddy, churned ground around the central fronts.
  const frontBlobs = [
    [1040, 650, 330], [1100, 980, 270], [1460, 820, 220],
    [1650, 1100, 260], [1840, 800, 220], [800, 600, 200]
  ];
  frontBlobs.forEach(([x, y, r]) => drawBlob(ctx, x, y, r, '#5b5039', 0.26));

  // Craters: concentrated around the places where armies have been fighting.
  const craterZones = [
    [1120, 600], [1060, 900], [1450, 1000], [1600, 1120], [1800, 790], [760, 650]
  ];
  for (let i = 0; i < 240; i += 1) {
    const zone = craterZones[Math.floor(rng() * craterZones.length)];
    const x = zone[0] + (rng() - 0.5) * 390;
    const y = zone[1] + (rng() - 0.5) * 300;
    if (x < 40 || y < 40 || x > WORLD.w - 40 || y > WORLD.h - 40) continue;
    const r = 3 + rng() * 12;
    ctx.save();
    ctx.globalAlpha = 0.24 + rng() * 0.25;
    ctx.fillStyle = '#3f382b';
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * (0.45 + rng() * 0.35), rng() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(195,174,123,.24)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(x - 1, y - 1, r * 0.95, r * 0.45, rng() * Math.PI, 0.1, Math.PI - 0.2);
    ctx.stroke();
    if (r > 8) {
      ctx.fillStyle = 'rgba(83,76,53,.28)';
      ctx.beginPath();
      ctx.arc(x + r * 0.35, y + r * 0.3, r * 0.18, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Woods and hedgerows.
  const forests = [
    [470, 670, 210, 90], [840, 480, 150, 70], [300, 960, 150, 100],
    [1220, 550, 95, 55], [1380, 1260, 200, 90], [1920, 390, 180, 80],
    [2120, 940, 190, 100], [1150, 1380, 220, 70], [720, 1260, 160, 60],
    [1620, 280, 210, 80], [2260, 690, 120, 90]
  ];
  forests.forEach(([cx, cy, rx, ry]) => {
    const count = Math.floor((rx * ry) / 140);
    for (let i = 0; i < count; i += 1) {
      const angle = rng() * Math.PI * 2;
      const distance = Math.sqrt(rng());
      const x = cx + Math.cos(angle) * rx * distance;
      const y = cy + Math.sin(angle) * ry * distance;
      if (SECTORS.some(sector => Math.hypot(x - sector.x, y - sector.y) < 74)) continue;
      drawTree(ctx, x, y, 6 + rng() * 8, rng);
    }
  });

  // Scattered hedgerows and lone trees.
  for (let i = 0; i < 230; i += 1) {
    const x = 50 + rng() * (WORLD.w - 100);
    const y = 50 + rng() * (WORLD.h - 100);
    if (SECTORS.some(sector => Math.hypot(x - sector.x, y - sector.y) < 115)) continue;
    if (rng() > 0.72) {
      ctx.strokeStyle = 'rgba(50,59,36,.25)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const angle = rng() * Math.PI;
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(angle) * (30 + rng() * 60), y + Math.sin(angle) * (20 + rng() * 30));
      ctx.stroke();
    } else {
      drawTree(ctx, x, y, 5 + rng() * 5, rng);
    }
  }

  // Roads connecting the theatre's hubs.
  const roads = [
    [[330, 300], [370, 360], [520, 380], [610, 405], [705, 470], [770, 590]],
    [[770, 590], [640, 680], [850, 790], [940, 850], [1040, 900]],
    [[850, 790], [700, 920], [625, 1115]],
    [[330, 300], [470, 540], [625, 1115]],
    [[770, 590], [970, 610], [1120, 630], [1260, 580], [1550, 600]],
    [[1260, 355], [1190, 500], [1120, 630], [1285, 805], [1490, 1010]],
    [[1550, 600], [1680, 680], [1780, 850], [1900, 860], [2040, 545]],
    [[1550, 600], [1760, 590], [2040, 545], [2205, 285]],
    [[1730, 1225], [1600, 1120], [1490, 1010], [1550, 880], [1550, 600]],
    [[1730, 1225], [1880, 1080], [2050, 1150], [1900, 860]],
    [[1285, 805], [1450, 900], [1490, 1010], [1550, 1120], [1730, 1225]]
  ];
  roads.forEach(points => drawRoad(ctx, points, 6));

  drawRail(ctx, [[300, 250], [700, 300], [1120, 290], [1550, 380], [1900, 300], [2230, 360]]);
  drawRail(ctx, [[1550, 600], [1600, 800], [1600, 1080], [1730, 1225]]);
  drawRail(ctx, [[1550, 600], [1850, 620], [2040, 545]]);

  // River and its banks.
  const riverPoints = buildRiverPoints();
  const riverPath = new Path2D();
  riverPath.moveTo(riverPoints[0][0], riverPoints[0][1]);
  for (let i = 1; i < riverPoints.length; i += 1) riverPath.lineTo(riverPoints[i][0], riverPoints[i][1]);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(39,50,43,.72)';
  ctx.lineWidth = 56;
  ctx.stroke(riverPath);
  ctx.strokeStyle = '#4e6361';
  ctx.lineWidth = 44;
  ctx.stroke(riverPath);
  ctx.strokeStyle = '#637c78';
  ctx.lineWidth = 30;
  ctx.stroke(riverPath);
  ctx.strokeStyle = 'rgba(170,193,177,.25)';
  ctx.lineWidth = 2;
  ctx.stroke(riverPath);
  ctx.restore();

  // Bridge crossings. The nav grid uses the same coordinates.
  const bridges = [];
  roadBridges().forEach(([x, y, angle]) => {
    bridges.push({ x, y, angle });
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(46,40,29,.5)';
    ctx.fillRect(-36, -16, 72, 32);
    ctx.fillStyle = '#8d7b58';
    ctx.fillRect(-34, -12, 68, 24);
    ctx.strokeStyle = '#554a35';
    ctx.lineWidth = 1;
    for (let i = -30; i <= 30; i += 8) {
      ctx.beginPath();
      ctx.moveTo(i, -12);
      ctx.lineTo(i, 12);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(235,217,173,.28)';
    ctx.fillRect(-34, -12, 68, 2);
    ctx.restore();
  });

  // A living line of field works: zig-zagged trenches and sandbag walls.
  const trenchLines = [
    [[945, 380], [1025, 470], [1010, 560], [1080, 650], [1070, 745], [1110, 840], [1060, 930], [1015, 1030]],
    [[1380, 650], [1460, 735], [1430, 830], [1510, 920], [1540, 1010], [1590, 1100]],
    [[1690, 620], [1760, 700], [1740, 780], [1810, 860], [1790, 940]],
    [[735, 385], [800, 500], [770, 605], [830, 700], [800, 790]]
  ];
  trenchLines.forEach(line => {
    drawTrench(ctx, line, rng);
    drawBarbedWire(ctx, line, rng);
  });

  // Town footprints. Labels and ownership flags are drawn in the live layer.
  SECTORS.forEach(sector => drawTown(ctx, sector, rng));

  // Map edge darkening, like the edge of a field report.
  const edge = ctx.createRadialGradient(WORLD.w / 2, WORLD.h / 2, WORLD.h * 0.25, WORLD.w / 2, WORLD.h / 2, WORLD.w * 0.68);
  edge.addColorStop(0, 'rgba(18,20,14,0)');
  edge.addColorStop(1, 'rgba(15,17,12,.45)');
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);

  // Build the navigation grid after the river and bridges are known.
  const cell = 24;
  const cols = Math.ceil(WORLD.w / cell);
  const rows = Math.ceil(WORLD.h / cell);
  const walkable = new Uint8Array(cols * rows);
  walkable.fill(1);
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x = (col + 0.5) * cell;
      const y = (row + 0.5) * cell;
      let blocked = x < 24 || y < 24 || x > WORLD.w - 24 || y > WORLD.h - 24;
      if (!blocked) {
        for (let i = 0; i < riverPoints.length - 1; i += 1) {
          const [x1, y1] = riverPoints[i];
          const [x2, y2] = riverPoints[i + 1];
          const dist = distanceToSegment(x, y, x1, y1, x2, y2);
          if (dist < 25) { blocked = true; break; }
        }
      }
      if (blocked) {
        for (const bridge of bridges) {
          if (Math.hypot(x - bridge.x, y - bridge.y) < 34) { blocked = false; break; }
        }
      }
      if (blocked) walkable[row * cols + col] = 0;
    }
  }

  return {
    canvas,
    riverPoints,
    bridges,
    trenchLines,
    walkable,
    nav: { cell, cols, rows },
    rng
  };
}

function roadBridges() {
  return [
    [riverXAt(335) - 4, 335, 0.08],
    [riverXAt(630) - 4, 630, -0.04],
    [riverXAt(805) - 4, 805, 0.06],
    [riverXAt(1115) - 3, 1115, -0.05]
  ];
}

function distanceToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq ? ((px - x1) * dx + (py - y1) * dy) / lenSq : 0;
  t = Math.max(0, Math.min(1, t));
  const x = x1 + t * dx;
  const y = y1 + t * dy;
  return Math.hypot(px - x, py - y);
}

function drawTrench(ctx, line, rng) {
  const points = [];
  for (let i = 0; i < line.length - 1; i += 1) {
    const [x1, y1] = line[i];
    const [x2, y2] = line[i + 1];
    const len = Math.hypot(x2 - x1, y2 - y1);
    const dx = (x2 - x1) / len;
    const dy = (y2 - y1) / len;
    const nx = -dy;
    const ny = dx;
    const steps = Math.ceil(len / 22);
    for (let s = 0; s < steps; s += 1) {
      const t = s / steps;
      const zig = (s % 2 ? 1 : -1) * 5;
      points.push([lerp(x1, x2, t) + nx * zig, lerp(y1, y2, t) + ny * zig]);
    }
  }
  const path = new Path2D();
  path.moveTo(points[0][0], points[0][1]);
  points.slice(1).forEach(([x, y]) => path.lineTo(x, y));
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(40,34,24,.55)';
  ctx.lineWidth = 13;
  ctx.stroke(path);
  ctx.strokeStyle = '#5c4d35';
  ctx.lineWidth = 8;
  ctx.stroke(path);
  ctx.strokeStyle = 'rgba(216,190,134,.28)';
  ctx.lineWidth = 2;
  ctx.stroke(path);
  // Sandbag dots along the parapet.
  points.forEach(([x, y], index) => {
    if (index % 2) return;
    const angle = rng() * Math.PI;
    ctx.fillStyle = index % 4 ? '#9b875e' : '#907c55';
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(angle) * 7, y + Math.sin(angle) * 7, 4.2, 2.8, angle, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(46,38,25,.3)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  });
  ctx.restore();
}

function drawBarbedWire(ctx, line, rng) {
  const points = [];
  for (let i = 0; i < line.length - 1; i += 1) {
    const [x1, y1] = line[i];
    const [x2, y2] = line[i + 1];
    const len = Math.hypot(x2 - x1, y2 - y1);
    const nx = -(y2 - y1) / len;
    const ny = (x2 - x1) / len;
    const steps = Math.floor(len / 11);
    for (let s = 0; s <= steps; s += 1) {
      const t = s / Math.max(1, steps);
      const side = (s % 2 ? 1 : -1) * (12 + (s % 3) * 2.5);
      points.push([lerp(x1, x2, t) + nx * side, lerp(y1, y2, t) + ny * side]);
    }
  }
  ctx.save();
  ctx.strokeStyle = 'rgba(67,61,47,.42)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  points.forEach(([x, y], index) => {
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.strokeStyle = 'rgba(51,47,35,.5)';
  ctx.lineWidth = 0.7;
  points.forEach(([x, y], index) => {
    if (index % 2) return;
    ctx.beginPath();
    ctx.moveTo(x - 3.2, y - 2.2);
    ctx.lineTo(x + 3.2, y + 2.2);
    ctx.moveTo(x + 3.2, y - 2.2);
    ctx.lineTo(x - 3.2, y + 2.2);
    ctx.stroke();
  });
  ctx.restore();
}

function drawTown(ctx, sector, rng) {
  const scale = sector.capital ? 1.18 : 1;
  ctx.save();
  ctx.translate(sector.x, sector.y);
  // Worn earth around the settlement.
  drawBlob(ctx, 0, 0, 72 * scale, '#6d6448', 0.24);
  // A small ring road.
  ctx.strokeStyle = 'rgba(185,166,117,.28)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, 0, 54 * scale, 39 * scale, 0.12, 0, Math.PI * 2);
  ctx.stroke();
  const count = sector.capital ? 23 : 15;
  for (let i = 0; i < count; i += 1) {
    const angle = rng() * Math.PI * 2;
    const distance = 8 + rng() * 44 * scale;
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance * 0.7;
    const w = 7 + rng() * 10;
    const h = 6 + rng() * 8;
    const rot = (rng() - 0.5) * 0.8;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = 'rgba(30,30,23,.35)';
    ctx.fillRect(-w / 2 + 2.5, -h / 2 + 3, w, h);
    ctx.fillStyle = rng() > 0.7 ? '#a69a7a' : '#8a8066';
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.fillStyle = rng() > 0.55 ? '#6c4c3e' : '#5b4838';
    ctx.beginPath();
    ctx.moveTo(-w / 2 - 1.5, -h / 2);
    ctx.lineTo(0, -h / 2 - 5 - rng() * 4);
    ctx.lineTo(w / 2 + 1.5, -h / 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(224,204,157,.16)';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(-w / 2, -h / 2, w, h);
    ctx.restore();
  }
  if (sector.capital) {
    // A cathedral or parliament silhouette gives capitals a recognisable crown.
    ctx.save();
    ctx.translate(0, -14);
    ctx.fillStyle = '#8c8065';
    ctx.fillRect(-14, -8, 28, 18);
    ctx.fillStyle = '#6d533d';
    ctx.beginPath();
    ctx.moveTo(-16, -8);
    ctx.lineTo(0, -30);
    ctx.lineTo(16, -8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(237,216,166,.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -30);
    ctx.lineTo(0, -38);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

export function screenToWorld(camera, screenX, screenY, viewport) {
  return {
    x: camera.x + (screenX - viewport.width / 2) / camera.zoom,
    y: camera.y + (screenY - viewport.height / 2) / camera.zoom
  };
}

export function worldToScreen(camera, x, y, viewport) {
  return {
    x: (x - camera.x) * camera.zoom + viewport.width / 2,
    y: (y - camera.y) * camera.zoom + viewport.height / 2
  };
}

export { clamp, lerp, mulberry32, distanceToSegment, riverXAt };
