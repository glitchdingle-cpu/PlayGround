import { WORLD, SECTORS, FACTIONS, FACTION_ORDER } from './data.js';
import { clamp } from './world.js';

const ROLE_COLORS = {
  rifle: '#cbbd92',
  mg: '#b9b097',
  art: '#c6a36e',
  tank: '#aeb5a4',
  cav: '#b8a67f',
  elite: '#d4bd82'
};

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function fmtNum(value) {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return `${Math.floor(value)}`;
}

export class Renderer {
  constructor(canvas, game, world) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.game = game;
    this.world = world;
    this.width = 1440;
    this.height = 900;
    this.dpr = 1;
    this.territoryCanvas = document.createElement('canvas');
    this.territoryCanvas.width = 120;
    this.territoryCanvas.height = 75;
    this.territorySignature = '';
    this.territoryDirty = true;
    this.rain = Array.from({ length: 170 }, () => ({
      x: Math.random() * 1.2,
      y: Math.random(),
      speed: 0.8 + Math.random() * 1.2,
      length: 8 + Math.random() * 18,
      alpha: 0.2 + Math.random() * 0.5
    }));
    this.fogBands = Array.from({ length: 5 }, (_, index) => ({
      x: Math.random(),
      y: 0.15 + index * 0.16,
      speed: 0.003 + Math.random() * 0.004,
      size: 250 + Math.random() * 350,
      alpha: 0.035 + Math.random() * 0.035
    }));
    this.mouse = { x: 0, y: 0 };
    this.selectionBox = null;
    this.targetWorld = null;
    this.lastMinimap = 0;
    this.scorchTime = 0;
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(width * this.dpr);
    this.canvas.height = Math.floor(height * this.dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.game.registerViewport(width, height);
  }

  worldToScreen(x, y) {
    return {
      x: (x - this.game.camera.x) * this.game.camera.zoom + this.width / 2,
      y: (y - this.game.camera.y) * this.game.camera.zoom + this.height / 2
    };
  }

  screenToWorld(x, y) {
    return {
      x: this.game.camera.x + (x - this.width / 2) / this.game.camera.zoom,
      y: this.game.camera.y + (y - this.height / 2) / this.game.camera.zoom
    };
  }

  render(time) {
    const ctx = this.ctx;
    const game = this.game;
    const zoom = game.camera.zoom;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.fillStyle = '#161c17';
    ctx.fillRect(0, 0, this.width, this.height);

    const shake = game.shake > 0 ? game.shake : 0;
    const shakeX = (Math.random() - 0.5) * shake * 2.2;
    const shakeY = (Math.random() - 0.5) * shake * 2.2;

    ctx.save();
    ctx.translate(this.width / 2 + shakeX, this.height / 2 + shakeY);
    ctx.scale(zoom, zoom);
    ctx.translate(-game.camera.x, -game.camera.y);

    // The painted ground layer.
    ctx.drawImage(this.world.canvas, 0, 0);

    this.updateTerritory();
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.territoryCanvas, 0, 0, WORLD.w, WORLD.h);
    ctx.restore();

    // Cloud shadows drifting over the front.
    this.drawCloudShadows(ctx, time);

    // Scorches sit above the painted map but below the living battlefield.
    for (const scorch of game.scorches) {
      ctx.save();
      ctx.globalAlpha = scorch.alpha;
      const gradient = ctx.createRadialGradient(scorch.x, scorch.y, 1, scorch.x, scorch.y, scorch.r);
      gradient.addColorStop(0, '#332d22');
      gradient.addColorStop(0.6, '#403827');
      gradient.addColorStop(1, 'rgba(55,48,35,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(scorch.x, scorch.y, scorch.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Ownership light around settlements.
    this.drawSectorFog(ctx);
    this.drawDistantBattle(ctx, time);

    for (const sector of game.sectors) this.drawSector(ctx, sector, time);

    // Selection and order paths.
    this.drawOrderPaths(ctx);

    // Units sorted back-to-front for a subtle depth effect.
    const units = [...game.units].filter(unit => !unit.dead).sort((a, b) => a.y - b.y);
    for (const unit of units) this.drawUnit(ctx, unit, time, zoom);

    this.drawProjectiles(ctx);
    this.drawTracers(ctx);
    this.drawParticles(ctx, time);
    this.drawTargeting(ctx, time);

    if (game.activeId && game.selected.size === 0 && game.selectedSectorId === null) {
      // A quiet reminder of the active banner when the board is empty.
      this.drawFrontMarker(ctx, time);
    }

    ctx.restore();

    this.drawScreenEffects(ctx, time);
    this.drawHover(ctx, zoom);
    if (this.selectionBox) this.drawSelectionBox(ctx);
  }

  drawCloudShadows(ctx, time) {
    const t = time * 0.000011;
    ctx.save();
    ctx.globalAlpha = 0.11;
    ctx.fillStyle = '#1f291e';
    for (let i = 0; i < 4; i += 1) {
      const x = ((t * (0.5 + i * 0.12) + i * 0.27) % 1.4 - 0.2) * WORLD.w;
      const y = (0.15 + i * 0.21) * WORLD.h;
      ctx.beginPath();
      ctx.ellipse(x, y, 280 + i * 40, 100 + i * 18, -0.3, 0, Math.PI * 2);
      ctx.ellipse(x + 140, y + 40, 180, 65, 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  updateTerritory() {
    const signature = this.game.sectors.map(sector => sector.owner || 'none').join('|');
    if (signature === this.territorySignature && !this.territoryDirty) return;
    this.territorySignature = signature;
    this.territoryDirty = false;
    const canvas = this.territoryCanvas;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const sectors = this.game.sectors;
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const wx = (x + 0.5) / w * WORLD.w;
        const wy = (y + 0.5) / h * WORLD.h;
        let best = null;
        let bestD = Infinity;
        for (const sector of sectors) {
          const d = Math.hypot(wx - sector.x, wy - sector.y) + (sector.capital ? -20 : 0);
          if (d < bestD) { bestD = d; best = sector; }
        }
        if (!best || !best.owner) {
          ctx.fillStyle = 'rgba(50,53,42,.10)';
        } else {
          const color = FACTIONS[best.owner].color;
          const parsed = color.replace('#', '');
          const r = parseInt(parsed.slice(0, 2), 16);
          const g = parseInt(parsed.slice(2, 4), 16);
          const b = parseInt(parsed.slice(4, 6), 16);
          ctx.fillStyle = `rgba(${r},${g},${b},0.21)`;
        }
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  drawDistantBattle(ctx, time) {
    // Smoke columns and gun-flashes bloom from the most contested parts of the front.
    const fronts = [
      [1080, 640, 0.1], [1020, 905, 2.2], [1450, 955, 4.4],
      [1665, 1115, 1.3], [1810, 780, 3.5], [815, 650, 5.4]
    ];
    for (let index = 0; index < fronts.length; index += 1) {
      const [x, y, phase] = fronts[index];
      const pulse = Math.sin(time * 0.0017 + phase * 2.7);
      if (pulse > 0.86) {
        ctx.save();
        ctx.globalAlpha = (pulse - 0.86) * 1.6;
        const glow = ctx.createRadialGradient(x, y, 0, x, y, 38);
        glow.addColorStop(0, 'rgba(255,221,147,.8)');
        glow.addColorStop(0.35, 'rgba(222,166,82,.25)');
        glow.addColorStop(1, 'rgba(197,138,62,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, 38, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      for (let puff = 0; puff < 3; puff += 1) {
        const t = ((time * 0.000028 + phase + puff * 0.17) % 1);
        const px = x + Math.sin(time * 0.00031 + phase + puff) * 18 + t * 38;
        const py = y - t * 76;
        const size = 12 + t * 34;
        ctx.save();
        ctx.globalAlpha = Math.sin(t * Math.PI) * (0.05 + (index % 3) * 0.012);
        ctx.fillStyle = index % 2 ? '#474438' : '#585140';
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  drawSectorFog(ctx) {
    for (const sector of this.game.sectors) {
      if (!sector.owner) continue;
      const faction = FACTIONS[sector.owner];
      ctx.save();
      ctx.globalAlpha = sector.owner === this.game.activeId ? 0.09 : 0.04;
      const gradient = ctx.createRadialGradient(sector.x, sector.y, 4, sector.x, sector.y, sector.radius * 1.5);
      gradient.addColorStop(0, faction.colorLight);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(sector.x, sector.y, sector.radius * 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  drawSector(ctx, sector, time) {
    const game = this.game;
    const faction = sector.owner ? FACTIONS[sector.owner] : null;
    const active = sector.owner === game.activeId;
    const selected = sector.id === game.selectedSectorId;
    const hovered = sector.id === game.hoverSectorId;
    const color = faction ? faction.color : '#8f886f';
    const light = faction ? faction.colorLight : '#d8d0b4';
    const pulse = Math.max(0, sector.pulse);
    const radius = sector.radius;

    ctx.save();
    ctx.translate(sector.x, sector.y);

    if (selected || hovered || sector.contested || pulse > 0) {
      ctx.globalAlpha = 0.22 + pulse * 0.18;
      ctx.strokeStyle = sector.contested ? '#c86952' : color;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 8]);
      ctx.beginPath();
      ctx.arc(0, 0, radius + 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (sector.captureTeam || sector.progress > 0) {
      const captureFaction = sector.captureTeam ? FACTIONS[sector.captureTeam] : null;
      ctx.strokeStyle = captureFaction ? captureFaction.colorLight : '#d8c590';
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.53, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (sector.progress / 100));
      ctx.stroke();
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = '#161914';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.53, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (sector.contested) {
      const tw = Math.sin(time * 0.004) * 0.15 + 1;
      ctx.save();
      ctx.scale(tw, tw);
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = '#d36b51';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#e1a071';
      ctx.beginPath();
      ctx.arc(0, -radius * 0.7, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Flag and label.
    this.drawFlag(ctx, 0, -radius * 0.34, color, light, sector.capital, time, active ? 1.06 : 0.92);

    if (globalThis.__renderSectorLabels !== false && game.camera.zoom > 0.56 || selected || hovered) {
      const capitalTag = sector.capital ? '★ ' : '';
      const label = `${capitalTag}${sector.name.toUpperCase()}`;
      ctx.font = sector.capital ? '700 12px Georgia, serif' : '600 11px Georgia, serif';
      const textWidth = ctx.measureText(label).width;
      const plateWidth = textWidth + 18;
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = 'rgba(18,22,17,.72)';
      roundRect(ctx, -plateWidth / 2, radius * 0.34, plateWidth, 18, 3);
      ctx.fill();
      ctx.strokeStyle = active ? 'rgba(232,202,128,.75)' : 'rgba(203,190,156,.3)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.fillStyle = active ? '#f0d89e' : '#e0d7bd';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, 0, radius * 0.34 + 9.5);
    }

    if (active && selected) {
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = '#e8ce8f';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.78, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawFlag(ctx, x, y, color, light, capital, time, scale) {
    const wave = Math.sin(time * 0.003 + x * 0.02) * 1.8;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.strokeStyle = 'rgba(33,31,23,.65)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, 4);
    ctx.lineTo(0, -31);
    ctx.stroke();
    ctx.fillStyle = 'rgba(20,21,16,.3)';
    ctx.beginPath();
    ctx.ellipse(1, 4, 7, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(1, -31);
    ctx.quadraticCurveTo(10, -30 + wave, 20, -28 + wave);
    ctx.lineTo(18, -18 + wave);
    ctx.quadraticCurveTo(9, -18 - wave, 1, -20);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = light;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 0.8;
    ctx.stroke();
    if (capital) {
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#f2da98';
      ctx.beginPath();
      ctx.arc(12, -24, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawOrderPaths(ctx) {
    const selected = this.game.selectedUnits;
    if (!selected.length) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(231,205,142,.42)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([5, 7]);
    for (const unit of selected) {
      if (!unit.path.length) continue;
      const end = unit.path[unit.path.length - 1];
      ctx.beginPath();
      ctx.moveTo(unit.x, unit.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawUnit(ctx, unit, time, zoom) {
    const game = this.game;
    const faction = FACTIONS[unit.teamId];
    const selected = game.selected.has(unit.id);
    const hovered = game.hoverUnitId === unit.id;
    const enemy = unit.teamId !== game.activeId;
    const def = unit.def;
    const radius = def.radius;
    const movingBob = unit.moving ? Math.sin(unit.bob) * 0.9 : 0;
    const healthRatio = clamp(unit.hp / unit.maxHp, 0, 1);

    ctx.save();
    ctx.translate(unit.x, unit.y + movingBob);
    const unitScale = def.sprite === 'tank' ? 1.27 : 1.38;
    ctx.scale(unitScale, unitScale);

    // Ground shadow and a quiet team-colour base.
    ctx.fillStyle = 'rgba(18,20,14,.34)';
    ctx.beginPath();
    ctx.ellipse(2.8, 6.2, radius * 1.04, radius * 0.48, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = faction.color;
    ctx.beginPath();
    ctx.ellipse(0.5, 3.8, radius * 1.05, radius * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    if (selected || hovered) {
      ctx.strokeStyle = selected ? '#e6cb8b' : 'rgba(225,212,175,.6)';
      ctx.lineWidth = selected ? 1.7 : 1.1;
      ctx.beginPath();
      ctx.arc(0, 0, radius + 5 + (selected ? Math.sin(time * 0.005) * 0.7 : 0), 0, Math.PI * 2);
      ctx.stroke();
      if (selected) {
        ctx.globalAlpha = 0.42;
        ctx.strokeStyle = '#e6cb8b';
        ctx.setLineDash([2, 5]);
        ctx.beginPath();
        ctx.arc(0, 0, radius + 9, time * 0.001, time * 0.001 + Math.PI * 1.7);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
    }
    if (hovered && enemy) {
      ctx.strokeStyle = 'rgba(208,100,76,.85)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, radius + 8, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Entrenchment: a rough sandbag parapet around the soldier.
    if (unit.entrench > 0.2) {
      const strength = unit.entrench;
      ctx.save();
      ctx.rotate(unit.facing + Math.PI);
      ctx.globalAlpha = 0.5 + strength * 0.4;
      for (let i = -2; i <= 2; i += 1) {
        ctx.fillStyle = i % 2 ? '#9e8b63' : '#8d7957';
        ctx.beginPath();
        ctx.ellipse(radius + 6, i * 5.5, 3.6, 2.3, 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(49,42,30,.4)';
        ctx.lineWidth = 0.6;
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.save();
    ctx.rotate(unit.facing);
    const teamColor = faction.color;
    const dark = faction.colorDark;
    const light = faction.colorLight;

    if (def.sprite === 'tank') {
      this.drawTank(ctx, unit, teamColor, dark, light);
    } else if (def.sprite === 'art') {
      this.drawArtillery(ctx, unit, teamColor, dark, light);
    } else if (def.sprite === 'cav') {
      this.drawCavalry(ctx, unit, teamColor, dark, light, time);
    } else if (def.sprite === 'mg') {
      this.drawMachineGun(ctx, unit, teamColor, dark, light);
    } else {
      this.drawRifleman(ctx, unit, teamColor, dark, light, time);
    }
    ctx.restore();

    if (unit.damageFlash > 0) {
      ctx.globalAlpha = unit.damageFlash * 3.8;
      ctx.fillStyle = '#f3e7c8';
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Muzzle glow.
    if (unit.muzzle > 0) {
      ctx.save();
      ctx.rotate(unit.facing);
      ctx.globalAlpha = unit.muzzle * 9;
      ctx.fillStyle = '#ffe8ae';
      ctx.beginPath();
      ctx.arc(radius + 7, 0, 3.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Suppression and entrenchment indicators.
    if (unit.suppress > 58) {
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = '#d5c07e';
      ctx.beginPath();
      ctx.arc(-radius - 4, -radius - 4, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    if (unit.order.type === 'dig' && unit.digTimer > 0) {
      ctx.strokeStyle = '#dfc37e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, radius + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(unit.digTimer / 2.2, 0, 1));
      ctx.stroke();
    }

    // Health and status only when it matters.
    if (selected || hovered || healthRatio < 0.99 || unit.underFire) {
      const barWidth = Math.max(22, radius * 2.4);
      const barY = -radius - 12;
      ctx.fillStyle = 'rgba(16,18,14,.75)';
      roundRect(ctx, -barWidth / 2 - 1, barY - 1, barWidth + 2, 4.6, 2);
      ctx.fill();
      ctx.fillStyle = healthRatio > 0.5 ? '#9bb276' : healthRatio > 0.25 ? '#d2a55d' : '#c55f4c';
      roundRect(ctx, -barWidth / 2, barY, barWidth * healthRatio, 2.6, 1.3);
      ctx.fill();
      if (unit.entrench > 0.8) {
        ctx.fillStyle = '#e3c785';
        ctx.beginPath();
        ctx.moveTo(barWidth / 2 + 5, barY - 1);
        ctx.lineTo(barWidth / 2 + 9, barY + 2);
        ctx.lineTo(barWidth / 2 + 5, barY + 5);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  drawRifleman(ctx, unit, teamColor, dark, light, time) {
    const stride = unit.moving ? Math.sin(unit.bob) * 3 : 0;
    ctx.strokeStyle = '#3d3526';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-3, 3);
    ctx.lineTo(-5 + stride, 8);
    ctx.moveTo(1, 3);
    ctx.lineTo(2 - stride, 8);
    ctx.stroke();

    ctx.fillStyle = dark;
    roundRect(ctx, -8, -3.2, 5.5, 6.4, 1.4);
    ctx.fill();
    ctx.fillStyle = teamColor;
    ctx.beginPath();
    ctx.ellipse(0, 0, 8, 5.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = light;
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.ellipse(-1.5, -1.5, 3.5, 2.2, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Rifle, held across the body.
    ctx.strokeStyle = '#433a2a';
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.moveTo(4, 2);
    ctx.lineTo(18, 3.2);
    ctx.stroke();
    ctx.strokeStyle = '#988567';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(15, 3.1);
    ctx.lineTo(18.5, 3.3);
    ctx.stroke();

    ctx.fillStyle = '#3d4036';
    ctx.beginPath();
    ctx.arc(3, -2.2, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#20231d';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(3, -2.2, 3.9, Math.PI, Math.PI * 2);
    ctx.stroke();

    if (unit.def.key === 'special') {
      ctx.fillStyle = '#b95746';
      ctx.fillRect(-8, -3.8, 5, 1.6);
    }
  }

  drawMachineGun(ctx, unit, teamColor, dark, light) {
    ctx.strokeStyle = '#3c3428';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-5, 1);
    ctx.lineTo(-8, 9);
    ctx.moveTo(2, 2);
    ctx.lineTo(5, 9);
    ctx.moveTo(0, 3);
    ctx.lineTo(0, 9);
    ctx.stroke();
    ctx.fillStyle = teamColor;
    roundRect(ctx, -8, -4, 11, 8, 2);
    ctx.fill();
    ctx.fillStyle = light;
    ctx.globalAlpha = 0.36;
    roundRect(ctx, -7, -3, 6, 2.2, 1);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = dark;
    ctx.fillRect(2, -2.2, 8, 4.4);
    ctx.strokeStyle = '#3e372b';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(9, 0);
    ctx.lineTo(22, 0);
    ctx.stroke();
    ctx.strokeStyle = '#b7a47c';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(23, 0);
    ctx.stroke();
    ctx.fillStyle = '#4c4c3d';
    ctx.beginPath();
    ctx.arc(-2, -3.4, 2.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2f322a';
    ctx.beginPath();
    ctx.arc(-2, -3.4, 2.1, 0, Math.PI * 2);
    ctx.fill();
  }

  drawArtillery(ctx, unit, teamColor, dark, light) {
    const big = unit.def.key === 'special' ? 1.25 : 1;
    ctx.save();
    ctx.scale(big, big);
    ctx.strokeStyle = '#3e3628';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-9, -7);
    ctx.lineTo(-15, -13);
    ctx.moveTo(-9, 7);
    ctx.lineTo(-15, 13);
    ctx.stroke();
    // Wheels.
    ctx.fillStyle = '#544a36';
    ctx.beginPath();
    ctx.arc(-7, -7, 4.3, 0, Math.PI * 2);
    ctx.arc(-7, 7, 4.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#a99872';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(-7, -7, 2.1, 0, Math.PI * 2);
    ctx.arc(-7, 7, 2.1, 0, Math.PI * 2);
    ctx.stroke();
    // Shield and trail.
    ctx.fillStyle = teamColor;
    roundRect(ctx, -10, -5.5, 11, 11, 2);
    ctx.fill();
    ctx.strokeStyle = dark;
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.fillStyle = dark;
    ctx.fillRect(-9, -1.5, 8, 3);
    // Barrel.
    ctx.strokeStyle = '#343126';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(20, 0);
    ctx.stroke();
    ctx.strokeStyle = '#8e8063';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(23, 0);
    ctx.stroke();
    ctx.restore();
  }

  drawTank(ctx, unit, teamColor, dark, light) {
    // Tracked rhomboid.
    ctx.fillStyle = '#36392e';
    roundRect(ctx, -15, -9, 29, 18, 5);
    ctx.fill();
    ctx.strokeStyle = '#60634d';
    ctx.lineWidth = 1.2;
    for (let i = -12; i < 12; i += 5) {
      ctx.beginPath();
      ctx.moveTo(i, -8);
      ctx.lineTo(i, 8);
      ctx.stroke();
    }
    ctx.fillStyle = teamColor;
    ctx.beginPath();
    ctx.moveTo(-13, -7);
    ctx.lineTo(12, -6);
    ctx.lineTo(15, 0);
    ctx.lineTo(12, 6);
    ctx.lineTo(-13, 7);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = dark;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.fillStyle = light;
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.ellipse(-3, -2, 7, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#393b2e';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(4, 0);
    ctx.lineTo(24, 0);
    ctx.stroke();
    ctx.strokeStyle = '#bcb18e';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(22, 0);
    ctx.lineTo(26, 0);
    ctx.stroke();
    if (unit.def.key === 'special') {
      ctx.fillStyle = '#d2bb7e';
      ctx.beginPath();
      ctx.arc(-8, -5, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawCavalry(ctx, unit, teamColor, dark, light, time) {
    const stride = unit.moving ? Math.sin(unit.bob * 1.4) * 3 : 0;
    ctx.strokeStyle = '#41382a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-7, 4);
    ctx.lineTo(-10 + stride, 10);
    ctx.moveTo(0, 5);
    ctx.lineTo(1 - stride, 11);
    ctx.moveTo(7, 3);
    ctx.lineTo(10 + stride, 9);
    ctx.stroke();
    ctx.fillStyle = '#574b37';
    ctx.beginPath();
    ctx.ellipse(0, 0, 13, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = teamColor;
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 4.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#65573d';
    ctx.beginPath();
    ctx.ellipse(13, -2, 4.2, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#312c21';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(13, 4);
    ctx.lineTo(14, 11);
    ctx.stroke();
    // Rider.
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.arc(0, -3, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#b6a67d';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(3, -3);
    ctx.lineTo(14, -8);
    ctx.stroke();
  }

  drawProjectiles(ctx) {
    for (const shot of this.game.projectiles) {
      const t = clamp(shot.t / shot.duration, 0, 1);
      const x = shot.x1 + (shot.tx - shot.x1) * t;
      const y = shot.y1 + (shot.ty - shot.y1) * t;
      const arc = Math.sin(t * Math.PI) * Math.min(42, 12 + Math.hypot(shot.tx - shot.x1, shot.ty - shot.y1) * 0.04);
      ctx.save();
      ctx.globalAlpha = 0.65;
      ctx.fillStyle = 'rgba(34,31,22,.5)';
      ctx.beginPath();
      ctx.ellipse(x, y, 2.5, 1.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = 'rgba(247,213,143,.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - (shot.tx - shot.x1) * 0.012, y - arc - (shot.ty - shot.y1) * 0.012);
      ctx.lineTo(x, y - arc);
      ctx.stroke();
      ctx.fillStyle = '#f0d38c';
      ctx.beginPath();
      ctx.arc(x, y - arc, 1.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  drawTracers(ctx) {
    for (const tracer of this.game.tracers) {
      const alpha = clamp(tracer.life / tracer.maxLife, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha * 0.9;
      ctx.strokeStyle = tracer.color;
      ctx.lineWidth = tracer.width;
      ctx.beginPath();
      ctx.moveTo(tracer.x1, tracer.y1);
      ctx.lineTo(tracer.x2, tracer.y2);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawParticles(ctx, time) {
    for (const particle of this.game.particles) {
      const alpha = clamp(particle.life / particle.maxLife, 0, 1);
      ctx.save();
      if (particle.kind === 'smoke') {
        ctx.globalAlpha = alpha * 0.24;
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (particle.kind === 'debris' || particle.kind === 'spark' || particle.kind === 'hit') {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (particle.kind === 'flash') {
        ctx.globalAlpha = alpha * 0.8;
        const gradient = ctx.createRadialGradient(particle.x, particle.y, 0, particle.x, particle.y, particle.size);
        gradient.addColorStop(0, particle.color);
        gradient.addColorStop(0.4, 'rgba(242,196,108,.4)');
        gradient.addColorStop(1, 'rgba(240,160,70,0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (particle.kind === 'ring') {
        ctx.globalAlpha = alpha * 0.65;
        ctx.strokeStyle = particle.color;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.stroke();
      } else if (particle.kind === 'flag') {
        ctx.globalAlpha = alpha * 0.85;
        ctx.strokeStyle = particle.color;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(particle.x, particle.y);
        ctx.lineTo(particle.x, particle.y - 24);
        ctx.stroke();
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.moveTo(particle.x, particle.y - 24);
        ctx.lineTo(particle.x + 13, particle.y - 21 + Math.sin(time * 0.006) * 1.5);
        ctx.lineTo(particle.x + 11, particle.y - 14);
        ctx.lineTo(particle.x, particle.y - 16);
        ctx.closePath();
        ctx.fill();
      } else if (particle.kind === 'cross') {
        ctx.globalAlpha = alpha * 0.8;
        ctx.strokeStyle = particle.color;
        ctx.lineWidth = 1.2;
        const s = particle.size;
        ctx.beginPath();
        ctx.moveTo(particle.x - s, particle.y - s);
        ctx.lineTo(particle.x + s, particle.y + s);
        ctx.moveTo(particle.x + s, particle.y - s);
        ctx.lineTo(particle.x - s, particle.y + s);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  drawTargeting(ctx, time) {
    if (!this.targetWorld) return;
    const { x, y } = this.targetWorld;
    const radius = 90;
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = 0.74;
    ctx.strokeStyle = '#e1c57e';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([6, 7]);
    ctx.beginPath();
    ctx.arc(0, 0, radius, time * 0.001, time * 0.001 + Math.PI * 1.55);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(219,104,75,.8)';
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-18, 0);
    ctx.lineTo(-7, 0);
    ctx.moveTo(18, 0);
    ctx.lineTo(7, 0);
    ctx.moveTo(0, -18);
    ctx.lineTo(0, -7);
    ctx.moveTo(0, 18);
    ctx.lineTo(0, 7);
    ctx.stroke();
    ctx.fillStyle = 'rgba(18,21,16,.6)';
    roundRect(ctx, -55, 20, 110, 19, 3);
    ctx.fill();
    ctx.fillStyle = '#e8d298';
    ctx.font = '600 10px "Arial Narrow", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BARRAGE TARGET', 0, 33);
    ctx.restore();
  }

  drawFrontMarker(ctx, time) {
    const team = this.game.activeTeam;
    const sector = this.game.sectorMap.get(team.spawnSectorId);
    if (!sector) return;
    ctx.save();
    ctx.translate(sector.x, sector.y);
    ctx.globalAlpha = 0.32 + Math.sin(time * 0.002) * 0.08;
    ctx.strokeStyle = FACTIONS[this.game.activeId].colorLight;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 7]);
    ctx.beginPath();
    ctx.arc(0, 0, sector.radius * 0.68, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  drawScreenEffects(ctx, time) {
    const game = this.game;
    // Warm/cool field grade.
    const grade = ctx.createLinearGradient(0, 0, 0, this.height);
    grade.addColorStop(0, 'rgba(184,157,94,.035)');
    grade.addColorStop(0.55, 'rgba(22,27,20,0)');
    grade.addColorStop(1, 'rgba(15,18,13,.12)');
    ctx.fillStyle = grade;
    ctx.fillRect(0, 0, this.width, this.height);

    // Drifting mist.
    ctx.save();
    ctx.globalAlpha = game.weather.fog * 0.55;
    for (const band of this.fogBands) {
      const x = ((band.x + time * 0.000003 * band.speed * 100000) % 1.5 - 0.2) * this.width;
      const y = band.y * this.height;
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, band.size);
      gradient.addColorStop(0, 'rgba(220,224,201,.12)');
      gradient.addColorStop(1, 'rgba(210,220,198,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(x - band.size, y - band.size * 0.4, band.size * 2, band.size * 0.8);
    }
    ctx.restore();

    // Rain, drawn in screen space so it always reads cleanly.
    if (game.weather.rain > 0.06) {
      ctx.save();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(208,218,207,.28)';
      for (const drop of this.rain) {
        const x = ((drop.x + time * 0.0004 * drop.speed) % 1.1 - 0.05) * this.width;
        const y = ((drop.y + time * 0.0008 * drop.speed) % 1) * this.height;
        ctx.globalAlpha = drop.alpha * game.weather.rain;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 4, y + drop.length);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Artillery flash tint.
    if (game.flash > 0.01) {
      ctx.save();
      ctx.globalAlpha = game.flash;
      const gradient = ctx.createRadialGradient(this.width * 0.5, this.height * 0.45, 0, this.width * 0.5, this.height * 0.45, this.width * 0.75);
      gradient.addColorStop(0, 'rgba(248,208,132,.2)');
      gradient.addColorStop(1, 'rgba(213,104,57,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.restore();
    }

    // Vignette on the canvas itself keeps the HUD edges crisp.
    const vignette = ctx.createRadialGradient(this.width / 2, this.height / 2, Math.min(this.width, this.height) * 0.42, this.width / 2, this.height / 2, Math.max(this.width, this.height) * 0.72);
    vignette.addColorStop(0, 'rgba(11,14,10,0)');
    vignette.addColorStop(1, 'rgba(9,12,9,.48)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, this.width, this.height);
  }

  drawHover(ctx, zoom) {
    const game = this.game;
    if (game.hoverUnitId) {
      const unit = game.unitMap.get(game.hoverUnitId);
      if (!unit) return;
      const screen = this.worldToScreen(unit.x, unit.y);
      const faction = FACTIONS[unit.teamId];
      const label = `${unit.def.name} · ${faction.short}`;
      ctx.save();
      ctx.font = '600 11px Georgia, serif';
      const width = ctx.measureText(label).width + 18;
      const y = screen.y - 40;
      ctx.fillStyle = 'rgba(18,22,17,.88)';
      roundRect(ctx, screen.x - width / 2, y, width, 22, 3);
      ctx.fill();
      ctx.strokeStyle = unit.teamId === game.activeId ? 'rgba(226,198,132,.55)' : 'rgba(200,102,79,.55)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.fillStyle = unit.teamId === game.activeId ? '#e9daa9' : '#e3b49e';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, screen.x, y + 11);
      ctx.restore();
    } else if (game.hoverSectorId) {
      const sector = game.sectorMap.get(game.hoverSectorId);
      if (!sector) return;
      const screen = this.worldToScreen(sector.x, sector.y);
      const label = sector.capital ? `${sector.name} · CAPITAL` : sector.name;
      ctx.save();
      ctx.font = '600 11px Georgia, serif';
      const width = ctx.measureText(label).width + 18;
      const y = screen.y - 78;
      ctx.fillStyle = 'rgba(18,22,17,.85)';
      roundRect(ctx, screen.x - width / 2, y, width, 21, 3);
      ctx.fill();
      ctx.fillStyle = sector.owner ? FACTIONS[sector.owner].colorLight : '#d2c9ae';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, screen.x, y + 10.5);
      ctx.restore();
    }
  }

  drawSelectionBox(ctx) {
    const box = this.selectionBox;
    const x = Math.min(box.x1, box.x2);
    const y = Math.min(box.y1, box.y2);
    const w = Math.abs(box.x2 - box.x1);
    const h = Math.abs(box.y2 - box.y1);
    ctx.save();
    ctx.fillStyle = 'rgba(226,200,137,.08)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(233,210,153,.78)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(x + 0.5, y + 0.5, w, h);
    ctx.restore();
  }

  drawMinimap(canvas, time) {
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = canvas.clientWidth || 210;
    const cssH = canvas.clientHeight || 132;
    if (canvas.width !== Math.floor(cssW * dpr) || canvas.height !== Math.floor(cssH * dpr)) {
      canvas.width = Math.floor(cssW * dpr);
      canvas.height = Math.floor(cssH * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.fillStyle = '#1b211a';
    ctx.fillRect(0, 0, cssW, cssH);
    ctx.drawImage(this.world.canvas, 0, 0, cssW, cssH);
    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.drawImage(this.territoryCanvas, 0, 0, cssW, cssH);
    ctx.restore();

    const sx = cssW / WORLD.w;
    const sy = cssH / WORLD.h;
    for (const sector of this.game.sectors) {
      const x = sector.x * sx;
      const y = sector.y * sy;
      const color = sector.owner ? FACTIONS[sector.owner].color : '#a59a7c';
      ctx.fillStyle = color;
      ctx.strokeStyle = 'rgba(15,18,13,.75)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, sector.capital ? 3.4 : 2.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (sector.contested) {
        ctx.strokeStyle = '#d4795f';
        ctx.beginPath();
        ctx.arc(x, y, 5.5, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    for (const unit of this.game.units) {
      if (unit.dead) continue;
      if (unit.teamId === this.game.activeId) {
        ctx.fillStyle = unit.def.sprite === 'tank' ? '#f2dc9d' : '#e9ddb8';
      } else {
        ctx.fillStyle = 'rgba(231,198,157,.7)';
      }
      ctx.fillRect(unit.x * sx - 0.8, unit.y * sy - 0.8, 1.7, 1.7);
    }

    const camera = this.game.camera;
    const viewW = this.width / camera.zoom * sx;
    const viewH = this.height / camera.zoom * sy;
    const cx = camera.x * sx - viewW / 2;
    const cy = camera.y * sy - viewH / 2;
    ctx.strokeStyle = 'rgba(240,218,163,.9)';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx, cy, viewW, viewH);
    ctx.fillStyle = 'rgba(240,218,163,.05)';
    ctx.fillRect(cx, cy, viewW, viewH);

    ctx.strokeStyle = 'rgba(215,192,137,.32)';
    ctx.strokeRect(0.5, 0.5, cssW - 1, cssH - 1);
  }

  minimapToWorld(clientX, clientY, canvas) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: clamp((clientX - rect.left) / rect.width, 0, 1) * WORLD.w,
      y: clamp((clientY - rect.top) / rect.height, 0, 1) * WORLD.h
    };
  }
}
