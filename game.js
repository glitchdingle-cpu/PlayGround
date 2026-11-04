(() => {
  "use strict";

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  const SECTORS = [
    { name: "BOOT", quota: 10, time: 40, cap: 5, safeCap: 4, speed: 0.82, interval: 1.28, bomb: 0, root: 0 },
    { name: "USERSPACE", quota: 14, time: 42, cap: 6, safeCap: 5, speed: 0.98, interval: 1.12, bomb: 0.12, root: 0 },
    { name: "CACHE", quota: 18, time: 44, cap: 7, safeCap: 5, speed: 1.12, interval: 0.98, bomb: 0.16, root: 0 },
    { name: "REGISTRY", quota: 22, time: 46, cap: 8, safeCap: 6, speed: 1.28, interval: 0.88, bomb: 0.16, root: 0.13 },
    { name: "KERNEL", quota: 26, time: 48, cap: 9, safeCap: 6, speed: 1.44, interval: 0.79, bomb: 0.18, root: 0.17 },
    { name: "ROOT", quota: 30, time: 52, cap: 10, safeCap: 7, speed: 1.62, interval: 0.7, bomb: 0.2, root: 0.2 }
  ];

  const SAFE_NAMES = [
    "family_photo.jpg", "resume_v7.pdf", "kernel.sys", "cat.gif", "tax_2025.xlsx",
    "README.md", "passwords.txt", "boot.cfg", "memories.mp4", "system32.dll",
    "notes_final.txt", "vacation.png", "music_library.flac", "wedding.mp4", "backup.zip"
  ];

  const CORRUPT_NAMES = {
    worm: [
      "svchost.exe", "free_vbucks.exe", "not_a_virus.bat", "worm32.dll",
      "crypto_miner.exe", "totally_legit.msi", "cache_overflow.tmp", "spam_filter.dll",
      "clippy_again.exe", "delete_all.exe", "0xDEADBEEF.bin", "screamer.avi"
    ],
    bomb: ["payload.bmb", "detonator.exe", "logic_bomb.sys", "tick_tock.bin"],
    rootkit: ["rootkit.sys", "ring0.dll", "bootkit.efi", "kernel_patch.sys"]
  };

  const COLORS = {
    acid: "#c9ff3d",
    acidSoft: "rgba(201,255,61,0.22)",
    corrupt: "#ff4f63",
    corruptSoft: "rgba(255,79,99,0.22)",
    safe: "#43e6d3",
    safeSoft: "rgba(67,230,211,0.18)",
    amber: "#ffd166",
    ink: "#edf7ee",
    muted: "#718486"
  };

  const COMBO_WINDOW = 3.6;
  const STORAGE_BEST = "deleteAll.best.v1";
  const STORAGE_MUTE = "deleteAll.muted.v1";
  const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------------------------------------------------------------------------
  // DOM + utility
  // ---------------------------------------------------------------------------

  const $ = (selector) => document.querySelector(selector);
  const el = {
    shell: $("#shell"),
    arena: $("#arena"),
    canvas: $("#game"),
    menu: $("#menu"),
    howto: $("#howto"),
    modal: $("#modal"),
    modalCard: $("#modalCard"),
    modalTopline: $("#modalTopline"),
    modalClock: $("#modalClock"),
    modalKicker: $("#modalKicker"),
    modalTitle: $("#modalTitle"),
    modalDesc: $("#modalDesc"),
    modalStats: $("#modalStats"),
    modalPrimary: $("#modalPrimary"),
    modalSecondary: $("#modalSecondary"),
    modalFoot: $("#modalFoot"),
    sectorNum: $("#sectorNum"),
    sectorName: $("#sectorName"),
    scoreValue: $("#scoreValue"),
    integrityText: $("#integrityText"),
    integrityBar: $("#integrityBar"),
    purgeText: $("#purgeText"),
    purgeBar: $("#purgeBar"),
    timeText: $("#timeText"),
    timeBar: $("#timeBar"),
    comboMult: $("#comboMult"),
    comboBar: $("#comboBar"),
    chain: $("#chain"),
    nukeBtn: $("#nukeBtn"),
    nukeHint: $("#nukeHint"),
    nukeCharge: $("#nukeCharge"),
    nukeFx: $("#nukeFx"),
    toasts: $("#toasts"),
    hint: $("#hint"),
    bestScore: $("#bestScore"),
    menuClock: $("#menuClock"),
    howtoClock: $("#howtoClock"),
    pauseBtn: $("#pauseBtn"),
    soundBtn: $("#soundBtn"),
    startBtn: $("#startBtn"),
    howBtn: $("#howBtn"),
    howtoClose: $("#howtoClose"),
    integrityCell: $(".integrity-cell"),
    timeCell: $(".time-cell")
  };

  const canvas = el.canvas;
  const ctx = canvas.getContext("2d");

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const pad2 = (n) => String(n).padStart(2, "0");
  const money = (n) => String(Math.max(0, Math.floor(n))).padStart(6, "0");
  const clockString = () => new Date().toTimeString().slice(0, 8);
  const formatDuration = (seconds) => {
    const total = Math.max(0, Math.floor(seconds));
    return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;
  };

  function readStore(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : value;
    } catch {
      return fallback;
    }
  }

  function writeStore(key, value) {
    try { localStorage.setItem(key, String(value)); } catch { /* private mode */ }
  }

  function roundRect(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function fitText(text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let out = text;
    while (out.length > 3 && ctx.measureText(out + "…").width > maxWidth) out = out.slice(0, -1);
    return out + "…";
  }

  // ---------------------------------------------------------------------------
  // Sound
  // ---------------------------------------------------------------------------

  const sound = {
    ctx: null,
    noiseBuffer: null,
    enabled: !readStore(STORAGE_MUTE, false),

    init() {
      if (this.ctx) {
        if (this.ctx.state === "suspended") this.ctx.resume();
        return;
      }
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return;
      try {
        this.ctx = new AudioCtor();
        const length = Math.floor(this.ctx.sampleRate * 1.2);
        const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
        this.noiseBuffer = buffer;
      } catch {
        this.ctx = null;
      }
    },

    tone(freq, duration, type = "sine", volume = 0.025, endFreq = freq, delay = 0) {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(volume, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(gain).connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    },

    noise(duration, volume, frequency = 900, delay = 0) {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx || !this.noiseBuffer) return;
      const now = this.ctx.currentTime + delay;
      const source = this.ctx.createBufferSource();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      source.buffer = this.noiseBuffer;
      filter.type = "bandpass";
      filter.frequency.value = frequency;
      filter.Q.value = 0.7;
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      source.connect(filter).connect(gain).connect(this.ctx.destination);
      source.start(now);
      source.stop(now + duration + 0.02);
    },

    click() { this.tone(360, 0.045, "square", 0.012, 510); },
    tick() { this.tone(660, 0.025, "square", 0.008, 760); },
    delete(count = 1) {
      this.noise(0.075, 0.045, 1300 + count * 130);
      this.tone(170 - Math.min(60, count * 5), 0.09, "triangle", 0.025, 55);
    },
    combo(count) {
      const root = 330 + Math.min(6, count) * 36;
      this.tone(root, 0.09, "triangle", 0.024, root * 1.3);
      this.tone(root * 1.5, 0.12, "sine", 0.018, root * 1.8, 0.035);
      this.tone(root * 2, 0.13, "sine", 0.012, root * 2.4, 0.07);
    },
    armor() {
      this.tone(210, 0.08, "square", 0.02, 125);
      this.noise(0.09, 0.02, 1800);
    },
    safe() {
      this.tone(160, 0.22, "sawtooth", 0.035, 72);
      this.noise(0.18, 0.04, 420);
    },
    bomb() {
      this.noise(0.48, 0.09, 120);
      this.tone(68, 0.5, "sine", 0.06, 26);
    },
    nuke() {
      this.noise(0.8, 0.12, 260);
      this.tone(52, 0.65, "sine", 0.08, 22);
      this.tone(880, 0.35, "triangle", 0.03, 180);
    },
    clear() {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, index) => {
        this.tone(freq, 0.24, "triangle", 0.024, freq, index * 0.075);
      });
    },
    fail() {
      [330, 247, 196, 98].forEach((freq, index) => {
        this.tone(freq, 0.34, "sawtooth", 0.026, freq * 0.82, index * 0.14);
      });
      this.noise(0.7, 0.055, 180, 0.25);
    },
    start() {
      this.tone(180, 0.09, "square", 0.018, 240);
      this.tone(360, 0.12, "triangle", 0.022, 520, 0.08);
    },

    setEnabled(enabled) {
      this.enabled = enabled;
      writeStore(STORAGE_MUTE, !enabled);
      document.body.classList.toggle("is-muted", !enabled);
      document.querySelectorAll("[data-sound-toggle]").forEach((button) => {
        button.setAttribute("aria-pressed", String(enabled));
      });
      if (enabled) {
        this.init();
        this.click();
      }
      if (el.soundBtn) el.soundBtn.setAttribute("aria-label", enabled ? "Mute sound" : "Unmute sound");
    }
  };

  // ---------------------------------------------------------------------------
  // Game state
  // ---------------------------------------------------------------------------

  const view = { w: 0, h: 0, dpr: 1, scale: 1, bg: null };
  const pointer = { active: false, id: null, x: 0, y: 0, sx: 0, sy: 0, moved: false, type: "mouse", downAt: 0, inside: false };
  const G = {
    phase: "menu",
    modalKind: null,
    sectorIndex: 0,
    cfg: SECTORS[0],
    score: 0,
    shownScore: 0,
    integrity: 100,
    quota: 0,
    timeLeft: SECTORS[0].time,
    totalTime: SECTORS[0].time,
    combo: 0,
    comboTimer: 0,
    meter: 0,
    files: [],
    particles: [],
    popups: [],
    rings: [],
    shake: 0,
    flashRed: 0,
    flashWhite: 0,
    spawnTimer: 0,
    safeTimer: 0,
    clearTimer: 0,
    failReason: "",
    modalAction: null,
    pendingNext: 0,
    clock: 0,
    playClock: 0,
    runClock: 0,
    hintFade: false,
    stats: { deleted: 0, safeLost: 0, nukes: 0, bombs: 0, bestCombo: 0, rootkitHits: 0 },
    best: Number(readStore(STORAGE_BEST, 0)) || 0,
    bestCommitted: false,
    selectionPreview: null,
    hovered: null,
    bgBits: [],
    lastModal: 0
  };

  let idCounter = 0;
  const nextId = () => ++idCounter;
  const uiScale = () => clamp(Math.min(view.w / 1150, view.h / 690) + 0.15, 0.72, 1.22);
  const topMargin = () => (view.w <= 720 ? 68 : 80);
  const bottomMargin = () => (view.w <= 720 ? 82 : 94);

  function multiplierFor(combo) {
    return Math.min(8, 1 + Math.floor(combo / 4));
  }

  function comboMultiplier() {
    return multiplierFor(G.combo);
  }

  function currentSectorLabel() {
    return `${pad2(G.sectorIndex + 1)}/${pad2(SECTORS.length)}`;
  }

  // ---------------------------------------------------------------------------
  // Canvas sizing and background data
  // ---------------------------------------------------------------------------

  function makeBackground() {
    if (!view.w || !view.h) return;
    const gradient = ctx.createRadialGradient(view.w * 0.5, view.h * 0.48, 20, view.w * 0.5, view.h * 0.5, Math.max(view.w, view.h) * 0.7);
    gradient.addColorStop(0, "rgba(12,22,24,1)");
    gradient.addColorStop(0.58, "rgba(7,13,15,1)");
    gradient.addColorStop(1, "rgba(4,8,9,1)");
    view.bg = gradient;
    G.bgBits = Array.from({ length: 34 }, () => ({
      x: Math.random(),
      y: Math.random(),
      bit: Math.random() > 0.5 ? "1" : "0",
      alpha: rand(0.035, 0.095),
      drift: rand(-4, 4)
    }));
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const oldW = view.w;
    const oldH = view.h;
    view.w = rect.width;
    view.h = rect.height;
    view.dpr = Math.min(2, window.devicePixelRatio || 1);
    view.scale = uiScale();
    canvas.width = Math.round(rect.width * view.dpr);
    canvas.height = Math.round(rect.height * view.dpr);
    makeBackground();

    const b = playBounds();
    G.files.forEach((file) => {
      if (oldW && oldH) {
        file.x = file.x / oldW * view.w;
        file.y = file.y / oldH * view.h;
      }
      file.w = 78 * view.scale;
      file.h = 96 * view.scale;
      file.x = clamp(file.x, b.left, Math.max(b.left, b.right - file.w));
      file.y = clamp(file.y, b.top, Math.max(b.top, b.bottom - file.h));
    });
  }

  function playBounds() {
    const left = view.w <= 720 ? 9 : 16;
    return {
      left,
      right: Math.max(left + 40, view.w - left),
      top: topMargin(),
      bottom: Math.max(topMargin() + 80, view.h - bottomMargin())
    };
  }

  function hitTest(x, y) {
    for (let i = G.files.length - 1; i >= 0; i -= 1) {
      const f = G.files[i];
      if (f.spawnT < 0.18) continue;
      if (x >= f.x && x <= f.x + f.w && y >= f.y && y <= f.y + f.h) return f;
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Files, spawning, and world animation
  // ---------------------------------------------------------------------------

  function safeFile() {
    const name = pick(SAFE_NAMES);
    const ext = (name.split(".").pop() || "sys").toUpperCase().slice(0, 4);
    return {
      id: nextId(),
      corrupt: false,
      variant: "safe",
      name,
      ext,
      seed: Math.random() * 1000,
      x: 0,
      y: 0,
      w: 78 * view.scale,
      h: 96 * view.scale,
      vx: rand(-13, 13),
      vy: rand(-10, 10),
      hp: 1,
      maxHp: 1,
      fuse: 0,
      fuseMax: 0,
      spawnT: 0,
      flash: 0,
      age: 0,
      doomed: false
    };
  }

  function corruptFile(variant) {
    const cfg = G.cfg;
    let kind = variant;
    if (!kind) {
      const roll = Math.random();
      if (cfg.root > 0 && roll < cfg.root) kind = "rootkit";
      else if (cfg.bomb > 0 && roll < cfg.root + cfg.bomb) kind = "bomb";
      else kind = "worm";
    }
    const names = CORRUPT_NAMES[kind];
    const name = pick(names);
    const ext = (name.split(".").pop() || "exe").toUpperCase().slice(0, 4);
    const speed = (rand(17, 34) + G.sectorIndex * 3) * cfg.speed;
    const angle = rand(0, Math.PI * 2);
    const hp = kind === "rootkit" ? 2 : 1;
    return {
      id: nextId(),
      corrupt: true,
      variant: kind,
      name,
      ext,
      seed: Math.random() * 1000,
      x: 0,
      y: 0,
      w: 78 * view.scale,
      h: 96 * view.scale,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      hp,
      maxHp: hp,
      fuse: kind === "bomb" ? rand(7.5, 10.5) : 0,
      fuseMax: kind === "bomb" ? rand(9, 12) : 0,
      spawnT: 0,
      flash: 0,
      age: 0,
      doomed: false
    };
  }

  function findOpenPosition(w, h) {
    const b = playBounds();
    const maxX = Math.max(b.left, b.right - w);
    const maxY = Math.max(b.top, b.bottom - h);
    let best = { x: rand(b.left, maxX), y: rand(b.top, maxY) };
    let bestDistance = -1;
    for (let attempt = 0; attempt < 28; attempt += 1) {
      const spot = { x: rand(b.left, maxX), y: rand(b.top, maxY) };
      let nearest = Infinity;
      for (const other of G.files) {
        const dx = spot.x + w / 2 - (other.x + other.w / 2);
        const dy = spot.y + h / 2 - (other.y + other.h / 2);
        nearest = Math.min(nearest, Math.hypot(dx, dy));
      }
      if (nearest > 82) return spot;
      if (nearest > bestDistance) {
        bestDistance = nearest;
        best = spot;
      }
    }
    return best;
  }

  function spawnSafe(initial = false) {
    const file = safeFile();
    const spot = findOpenPosition(file.w, file.h);
    file.x = spot.x;
    file.y = spot.y;
    file.spawnT = initial ? 0.8 : 0;
    file.vy = rand(5, 12);
    G.files.push(file);
    return file;
  }

  function spawnCorrupt(variant) {
    const file = corruptFile(variant);
    const spot = findOpenPosition(file.w, file.h);
    file.x = spot.x;
    file.y = spot.y;
    file.spawnT = 0;
    G.files.push(file);
    return file;
  }

  function updateFiles(dt) {
    const b = playBounds();
    const expiredBombs = [];
    for (const f of G.files) {
      f.spawnT = Math.min(1, f.spawnT + dt * 3.8);
      f.flash = Math.max(0, f.flash - dt * 3.2);
      if (G.phase === "playing" || G.phase === "sectorClear" || G.phase === "gameoverAnim") {
        f.age += dt;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        f.vx *= 0.999;
        f.vy *= 0.999;
        if (f.x <= b.left) { f.x = b.left; f.vx = Math.abs(f.vx || 12); }
        if (f.x + f.w >= b.right) { f.x = b.right - f.w; f.vx = -Math.abs(f.vx || 12); }
        if (f.y <= b.top) { f.y = b.top; f.vy = Math.abs(f.vy || 10); }
        if (f.y + f.h >= b.bottom) { f.y = b.bottom - f.h; f.vy = -Math.abs(f.vy || 10); }
        if (G.phase === "playing" && f.corrupt && f.variant === "bomb") {
          f.fuse -= dt;
          if (f.fuse <= 0) expiredBombs.push(f);
        }
      }
    }

    // Gentle separation keeps labels readable without feeling rigid.
    for (let i = 0; i < G.files.length; i += 1) {
      for (let j = i + 1; j < G.files.length; j += 1) {
        const a = G.files[i];
        const c = G.files[j];
        const dx = (a.x + a.w / 2) - (c.x + c.w / 2);
        const dy = (a.y + a.h / 2) - (c.y + c.h / 2);
        const minX = (a.w + c.w) * 0.48;
        const minY = (a.h + c.h) * 0.44;
        if (Math.abs(dx) < minX && Math.abs(dy) < minY) {
          const pushX = (minX - Math.abs(dx)) * (dx < 0 ? -1 : 1) * 0.5;
          const pushY = (minY - Math.abs(dy)) * (dy < 0 ? -1 : 1) * 0.5;
          a.x += pushX;
          a.y += pushY;
          c.x -= pushX;
          c.y -= pushY;
        }
      }
    }

    G.files.forEach((f) => {
      f.x = clamp(f.x, b.left, Math.max(b.left, b.right - f.w));
      f.y = clamp(f.y, b.top, Math.max(b.top, b.bottom - f.h));
    });

    expiredBombs.forEach(detonateBomb);
  }

  function burst(x, y, color, count = 10, power = 1) {
    const amount = REDUCED_MOTION ? Math.ceil(count / 2) : count;
    for (let i = 0; i < amount; i += 1) {
      const angle = rand(0, Math.PI * 2);
      const speed = rand(28, 145) * power;
      G.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - rand(4, 30),
        gravity: rand(75, 170),
        life: rand(0.3, 0.72),
        maxLife: 0.72,
        size: rand(1.5, 4.8),
        color
      });
    }
  }

  function popup(x, y, text, color = COLORS.acid, size = 1) {
    G.popups.push({ x, y, text, color, life: 1.05, maxLife: 1.05, size });
  }

  function shockwave(x, y, color = COLORS.acid, maxR = 220) {
    G.rings.push({ x, y, color, r: 6, maxR, life: 0.6, maxLife: 0.6, width: 2 });
  }

  function toast(text, type = "", duration = 1900, big = false) {
    const node = document.createElement("div");
    node.className = `toast ${type}${big ? " big" : ""}`;
    node.textContent = text;
    el.toasts.appendChild(node);
    while (el.toasts.children.length > 4) el.toasts.firstElementChild.remove();
    window.setTimeout(() => {
      node.classList.add("out");
      window.setTimeout(() => node.remove(), 320);
    }, duration);
  }

  function removeFile(file) {
    const index = G.files.indexOf(file);
    if (index >= 0) G.files.splice(index, 1);
  }

  function destroyFile(file, color = COLORS.corrupt, amount = 13) {
    if (file.doomed) return;
    file.doomed = true;
    burst(file.x + file.w / 2, file.y + file.h / 2, color, amount, 1);
    if (file.variant === "rootkit") {
      burst(file.x + file.w / 2, file.y + file.h / 2, COLORS.amber, 8, 0.7);
    }
    removeFile(file);
  }

  function detonateBomb(file) {
    if (file.doomed || G.phase !== "playing") return;
    const x = file.x + file.w / 2;
    const y = file.y + file.h / 2;
    destroyFile(file, COLORS.amber, 30);
    G.integrity = Math.max(0, G.integrity - 17);
    G.combo = 0;
    G.comboTimer = 0;
    G.shake = Math.max(G.shake, 19);
    G.flashRed = Math.max(G.flashRed, 0.55);
    shockwave(x, y, COLORS.corrupt, 260);
    burst(x, y, COLORS.corrupt, 26, 1.5);
    popup(x, y - 20, "−17 INTEGRITY", COLORS.corrupt, 1);
    toast("DATA BOMB DETONATED // INTEGRITY −17", "danger", 2200);
    sound.bomb();
    if (G.integrity <= 0) failRun("INTEGRITY DEPLETED — THE CORRUPTION TOOK THE SYSTEM.");
  }

  // ---------------------------------------------------------------------------
  // Run flow
  // ---------------------------------------------------------------------------

  function commitBest() {
    if (G.score > G.best) {
      G.best = Math.floor(G.score);
      writeStore(STORAGE_BEST, G.best);
    }
    if (el.bestScore) el.bestScore.textContent = money(G.best);
    G.bestCommitted = true;
  }

  function startRun() {
    el.menu.classList.add("is-hidden");
    el.howto.classList.add("is-hidden");
    el.modal.classList.add("is-hidden");
    el.shell.classList.remove("is-hidden");
    el.hint.classList.remove("is-faded");
    resizeCanvas();

    G.phase = "playing";
    G.score = 0;
    G.shownScore = 0;
    G.integrity = 100;
    G.combo = 0;
    G.comboTimer = 0;
    G.meter = 0;
    G.stats = { deleted: 0, safeLost: 0, nukes: 0, bombs: 0, bestCombo: 0, rootkitHits: 0 };
    G.runClock = 0;
    G.bestCommitted = false;
    G.failReason = "";
    G.lastModal = 0;
    sound.init();
    sound.start();
    beginSector(0);
  }

  function beginSector(index) {
    G.sectorIndex = index;
    G.cfg = SECTORS[index];
    G.quota = 0;
    G.totalTime = G.cfg.time;
    G.timeLeft = G.cfg.time;
    G.combo = 0;
    G.comboTimer = 0;
    G.meter = 0;
    G.files = [];
    G.particles = [];
    G.popups = [];
    G.rings = [];
    G.spawnTimer = 1;
    G.safeTimer = 3.4;
    G.shake = 0;
    G.flashRed = 0;
    G.flashWhite = 0;
    G.hintFade = false;
    G.playClock = 0;
    G.phase = "playing";
    el.hint.classList.remove("is-faded");
    el.modal.classList.add("is-hidden");
    el.howto.classList.add("is-hidden");

    const b = playBounds();
    G.files.length = 0;
    for (let i = 0; i < 3; i += 1) {
      const safe = spawnSafe(true);
      if (b.right - b.left < 200) break;
    }
    for (let i = 0; i < 2; i += 1) {
      const corrupt = spawnCorrupt("worm");
      corrupt.spawnT = 0.35 + i * 0.15;
    }

    el.sectorNum.textContent = pad2(index + 1);
    el.sectorName.textContent = G.cfg.name;
    updateHud(true);
    toast(`SECTOR ${pad2(index + 1)} // ${G.cfg.name}`, "gold", 2000, true);
    window.setTimeout(() => {
      if (G.phase === "playing" && G.sectorIndex === index) {
        toast(`PURGE ${G.cfg.quota} CORRUPT FILES · PROTECT THE CYAN`, "", 2400);
      }
    }, 420);
  }

  function failRun(reason) {
    if (G.phase !== "playing") return;
    G.failReason = reason;
    G.phase = "gameoverAnim";
    G.clearTimer = 1.05;
    G.combo = 0;
    G.comboTimer = 0;
    G.flashRed = 0.8;
    G.shake = 24;
    G.meter = 0;
    sound.fail();
    toast("SYSTEM FAILURE IN PROGRESS", "danger", 1500);
  }

  function sectorComplete() {
    if (G.phase !== "playing") return;
    G.phase = "sectorClear";
    G.clearTimer = 1.5;
    G.combo = 0;
    G.comboTimer = 0;
    G.timeBonus = Math.round(G.timeLeft * 40);
    G.integrityBonus = Math.round(G.integrity * 10);
    G.score += G.timeBonus + G.integrityBonus;
    G.meter = 100;
    G.flashWhite = 0.5;
    G.shake = 17;
    sound.clear();

    const remaining = G.files.filter((file) => file.corrupt);
    remaining.forEach((file, index) => {
      window.setTimeout(() => {
        if (file.doomed) return;
        burst(file.x + file.w / 2, file.y + file.h / 2, index % 2 ? COLORS.safe : COLORS.corrupt, 11, 0.9);
        if (index % 4 === 0) shockwave(file.x + file.w / 2, file.y + file.h / 2, COLORS.acid, 150);
        destroyFile(file, COLORS.corrupt, 0);
      }, index * 55);
    });

    toast(`SECTOR ${pad2(G.sectorIndex + 1)} // ${G.cfg.name} CLEARED`, "gold", 2200, true);
    shockwave(view.w / 2, view.h / 2, COLORS.acid, Math.max(view.w, view.h));
  }

  function modalStats(items) {
    el.modalStats.innerHTML = items.map((item) => (
      `<div class="modal-stat"><span>${item.label}</span><b class="${item.tone || ""}">${item.value}</b></div>`
    )).join("");
  }

  function prepareModal(tone) {
    el.modal.classList.remove("is-hidden");
    el.howto.classList.add("is-hidden");
    el.modalCard.className = `modal-card${tone ? ` ${tone}` : ""}`;
    el.modalCard.style.animation = "none";
    void el.modalCard.offsetWidth;
    el.modalCard.style.animation = "";
    el.modalClock.textContent = clockString();
  }

  function showSectorModal() {
    G.phase = "modal";
    G.modalKind = "sector";
    G.pendingNext = G.sectorIndex + 1;
    prepareModal("");
    el.modalTopline.textContent = `SECTOR ${pad2(G.sectorIndex + 1)} // PURGE COMPLETE`;
    el.modalKicker.textContent = "NEUTRALIZED";
    el.modalTitle.innerHTML = `SECTOR <span>${pad2(G.sectorIndex + 1)}</span> CLEAR`;
    el.modalDesc.textContent = `${G.cfg.name} is clean. The mainframe is still bleeding. Reload, repair, repeat.`;
    modalStats([
      { label: "TIME BONUS", value: `+${G.timeBonus}`, tone: "acid" },
      { label: "INTEGRITY BONUS", value: `+${G.integrityBonus}`, tone: "acid" },
      { label: "TOTAL SCORE", value: money(G.score) }
    ]);
    G.modalAction = "next";
    el.modalPrimary.innerHTML = `NEXT: ${SECTORS[G.pendingNext].name} <b>→</b>`;
    el.modalSecondary.textContent = "ABORT RUN";
    el.modalFoot.textContent = `INTEGRITY RESTORES +10 ON DEPLOYMENT · ${SECTORS[G.pendingNext].quota} CORRUPT FILES INCOMING`;
    sound.clear();
  }

  function rankForScore(score) {
    if (score >= 42000) return "S";
    if (score >= 26000) return "A";
    if (score >= 13000) return "B";
    return "C";
  }

  function showVictoryModal() {
    G.phase = "modal";
    G.modalKind = "victory";
    commitBest();
    const rank = rankForScore(G.score);
    prepareModal("win");
    el.modalTopline.textContent = "ROOT ACCESS // MAINFRAME STATES: CLEAN";
    el.modalKicker.textContent = `TOTAL SYSTEM PURGE // RANK ${rank}`;
    el.modalTitle.innerHTML = "MAINFRAME <span>CLEAN</span>";
    el.modalDesc.textContent = `Every sector, every parasite, every last byte. The system is yours again. Final rank: ${rank}.`;
    modalStats([
      { label: "FINAL SCORE", value: money(G.score), tone: "acid" },
      { label: "FILES DELETED", value: String(G.stats.deleted) },
      { label: "BEST CHAIN", value: `×${multiplierFor(G.stats.bestCombo)}` }
    ]);
    G.modalAction = "victory";
    el.modalPrimary.innerHTML = "RUN IT AGAIN <b>→</b>";
    el.modalSecondary.textContent = "MAIN MENU";
    el.modalFoot.textContent = `BEST SCORE ${money(G.best)} · CLEANUP TIME ${formatDuration(G.runClock)}`;
    sound.clear();
  }

  function showGameOverModal() {
    G.phase = "modal";
    G.modalKind = "gameover";
    commitBest();
    prepareModal("danger");
    el.modalTopline.textContent = "CONNECTION TERMINATED // CORE OFFLINE";
    el.modalKicker.textContent = "PURGE FAILED";
    el.modalTitle.textContent = "SYSTEM FAILURE";
    el.modalDesc.textContent = G.failReason || "The corruption won this round.";
    modalStats([
      { label: "SECTOR REACHED", value: `${pad2(Math.min(SECTORS.length, G.sectorIndex + 1))} / ${pad2(SECTORS.length)}`, tone: "red" },
      { label: "FILES DELETED", value: String(G.stats.deleted) },
      { label: "FINAL SCORE", value: money(G.score) }
    ]);
    G.modalAction = "restart";
    el.modalPrimary.innerHTML = "REBOOT RUN <b>→</b>";
    el.modalSecondary.textContent = "MAIN MENU";
    el.modalFoot.textContent = `BEST SCORE ${money(G.best)} · FILES LOST TO SAFE-DELETE: ${G.stats.safeLost}`;
    sound.fail();
  }

  function pauseGame() {
    if (G.phase !== "playing") return;
    G.phase = "modal";
    G.modalKind = "pause";
    G.modalAction = "resume";
    prepareModal("");
    el.modalTopline.textContent = "CLEANUP SEQUENCE // SUSPENDED";
    el.modalKicker.textContent = "PAUSED";
    el.modalTitle.innerHTML = "HOLD THE <span>LINE</span>";
    el.modalDesc.textContent = "The corruption is holding its breath. Resume when you are ready.";
    modalStats([
      { label: "SECTOR", value: `${pad2(G.sectorIndex + 1)} / ${pad2(SECTORS.length)}` },
      { label: "SCORE", value: money(G.score) },
      { label: "INTEGRITY", value: `${Math.ceil(G.integrity)}%`, tone: G.integrity < 30 ? "red" : "acid" }
    ]);
    el.modalPrimary.innerHTML = "RESUME PURGE <b>→</b>";
    el.modalSecondary.textContent = "ABORT RUN";
    el.modalFoot.textContent = window.innerWidth <= 720 ? "TAP RESUME PURGE TO CONTINUE" : "PRESS P OR ESC TO RESUME";
    sound.click();
  }

  function resumeGame() {
    if (G.modalKind !== "pause") return;
    el.modal.classList.add("is-hidden");
    G.phase = "playing";
    G.modalKind = null;
    sound.click();
  }

  function quitToMenu() {
    commitBest();
    G.phase = "menu";
    G.modalKind = null;
    G.files = [];
    el.modal.classList.add("is-hidden");
    el.howto.classList.add("is-hidden");
    el.shell.classList.add("is-hidden");
    el.menu.classList.remove("is-hidden");
    el.bestScore.textContent = money(G.best);
    el.menu.scrollTop = 0;
    sound.click();
  }

  function handleModalPrimary() {
    if (G.modalKind === "sector") {
      G.score = Math.floor(G.score);
      G.integrity = Math.min(100, G.integrity + 10);
      beginSector(G.pendingNext);
      sound.start();
    } else if (G.modalKind === "pause") {
      resumeGame();
    } else {
      startRun();
    }
  }

  function handleModalSecondary() {
    if (G.modalKind === "pause") quitToMenu();
    else if (G.modalKind === "sector") quitToMenu();
    else quitToMenu();
  }

  // ---------------------------------------------------------------------------
  // Deletion logic
  // ---------------------------------------------------------------------------

  function applyTargets(corrupt, safe, center) {
    if (!corrupt.length && !safe.length) {
      sound.tick();
      return;
    }

    const mult = comboMultiplier();
    let kills = 0;
    let armorHits = 0;
    let base = 0;
    let defused = 0;
    let points = 0;
    const cx = center?.x ?? view.w / 2;
    const cy = center?.y ?? view.h / 2;

    corrupt.forEach((file) => {
      if (file.doomed) return;
      if (file.variant === "rootkit" && file.hp > 1) {
        file.hp -= 1;
        file.flash = 1;
        file.cracked = true;
        armorHits += 1;
        G.stats.rootkitHits += 1;
        points += 45 * mult;
        G.combo += 1;
        G.comboTimer = COMBO_WINDOW;
        G.meter = clamp(G.meter + 2, 0, 100);
        burst(file.x + file.w / 2, file.y + file.h / 2, COLORS.amber, 9, 0.7);
        popup(file.x + file.w / 2, file.y - 8, "ARMOR −1", COLORS.amber, 0.8);
        sound.armor();
        return;
      }
      kills += 1;
      base += file.variant === "bomb" ? 280 : file.variant === "rootkit" ? 260 : 125;
      if (file.variant === "bomb") {
        defused += 1;
        G.stats.bombs += 1;
        burst(file.x + file.w / 2, file.y + file.h / 2, COLORS.amber, 8, 0.8);
      }
      destroyFile(file, COLORS.corrupt, 14);
      G.stats.deleted += 1;
    });

    if (kills > 0) {
      const groupBonus = kills >= 2 ? (kills - 1) * 45 : 0;
      const multiBonus = kills >= 3 ? kills * kills * 12 : 0;
      const gained = Math.round((base + groupBonus + multiBonus) * mult + points);
      G.score += gained;
      G.quota += kills;
      G.combo += kills;
      G.comboTimer = COMBO_WINDOW;
      G.stats.bestCombo = Math.max(G.stats.bestCombo, G.combo);
      G.meter = clamp(G.meter + kills * 7 + (kills >= 3 ? 9 : 0) + (kills >= 5 ? 7 : 0), 0, 100);
      if (kills >= 4) G.integrity = Math.min(100, G.integrity + 1);
      popup(cx, cy - 22, `+${gained}`, COLORS.acid, kills >= 4 ? 1.45 : 1);
      if (kills >= 2) {
        popup(cx, cy + 5, comboMultiplier() > 1 ? `CHAIN ×${comboMultiplier()}` : "CLEAN SWEEP", COLORS.amber, 0.8);
      }
      if (kills >= 3) {
        toast(`${kills} FILES PURGED // CHAIN ×${comboMultiplier()}`, "gold", 1500);
      }
      if (defused) toast("PAYLOAD DEFUSED // NICE CATCH", "safe", 1600);
      shockwave(cx, cy, COLORS.acid, 90 + kills * 25);
      G.shake = Math.max(G.shake, 2 + Math.min(9, kills * 1.4));
      if (kills >= 3) G.flashWhite = Math.max(G.flashWhite, 0.08);
      sound.combo(Math.min(kills, 6));
    } else if (armorHits > 0) {
      G.score += Math.round(points);
      popup(cx, cy - 12, `+${Math.round(points)}`, COLORS.amber, 0.9);
      sound.armor();
    }

    if (safe.length) {
      const loss = safe.length * 7;
      safe.forEach((file) => {
        burst(file.x + file.w / 2, file.y + file.h / 2, COLORS.safe, 14, 1.1);
        burst(file.x + file.w / 2, file.y + file.h / 2, COLORS.corrupt, 8, 0.8);
        destroyFile(file, COLORS.safe, 0);
        G.stats.safeLost += 1;
      });
      G.integrity = Math.max(0, G.integrity - loss);
      G.score = Math.max(0, G.score - 80 * safe.length);
      G.combo = 0;
      G.comboTimer = 0;
      G.meter = Math.max(0, G.meter - 5 * safe.length);
      popup(cx, cy + 22, `−${loss} INTEGRITY`, COLORS.corrupt, 1.1);
      toast(`SYSTEM FILE DELETED // INTEGRITY −${loss}`, "danger", 2200);
      G.flashRed = Math.max(G.flashRed, 0.55);
      G.shake = Math.max(G.shake, 10);
      sound.safe();
      if (G.integrity <= 0) {
        failRun("INTEGRITY DEPLETED — YOU DELETED THE SYSTEM YOU WERE SAVING.");
        updateHud();
        return;
      }
    }

    updateHud();
    if (G.quota >= G.cfg.quota) sectorComplete();
  }

  function selectionContents(rect) {
    const corrupt = [];
    const safe = [];
    const x1 = Math.min(rect.x1, rect.x2);
    const x2 = Math.max(rect.x1, rect.x2);
    const y1 = Math.min(rect.y1, rect.y2);
    const y2 = Math.max(rect.y1, rect.y2);
    for (const file of G.files) {
      if (file.spawnT < 0.22 || file.doomed) continue;
      const cx = file.x + file.w / 2;
      const cy = file.y + file.h / 2;
      if (cx >= x1 && cx <= x2 && cy >= y1 && cy <= y2) {
        if (file.corrupt) corrupt.push(file);
        else safe.push(file);
      }
    }
    return { corrupt, safe };
  }

  function handleBox(rect) {
    const inside = selectionContents(rect);
    const center = { x: (rect.x1 + rect.x2) / 2, y: (rect.y1 + rect.y2) / 2 };
    G.selectionPreview = null;
    applyTargets(inside.corrupt, inside.safe, center);
  }

  function handleClick(x, y) {
    const hit = hitTest(x, y);
    if (!hit) {
      sound.tick();
      return;
    }
    if (hit.corrupt) applyTargets([hit], [], { x: hit.x + hit.w / 2, y: hit.y + hit.h / 2 });
    else applyTargets([], [hit], { x: hit.x + hit.w / 2, y: hit.y + hit.h / 2 });
  }

  function activateNuke() {
    if (G.phase !== "playing" || G.meter < 100) return;
    const corrupt = G.files.filter((file) => file.corrupt && !file.doomed);
    if (!corrupt.length) {
      toast("NO CORRUPTION IN RANGE", "safe", 1500);
      sound.tick();
      return;
    }

    const mult = comboMultiplier();
    let base = 0;
    corrupt.forEach((file, index) => {
      base += file.variant === "bomb" ? 280 : file.variant === "rootkit" ? 260 : 125;
      if (file.variant === "bomb") G.stats.bombs += 1;
      G.stats.deleted += 1;
      burst(file.x + file.w / 2, file.y + file.h / 2, index % 3 === 0 ? COLORS.amber : COLORS.corrupt, 18, 1.4);
      if (index % 5 === 0) shockwave(file.x + file.w / 2, file.y + file.h / 2, COLORS.acid, 180);
      destroyFile(file, COLORS.corrupt, 0);
    });

    const gained = Math.round(base * 1.5 * mult);
    G.score += gained;
    G.quota += corrupt.length;
    G.combo += corrupt.length;
    G.comboTimer = COMBO_WINDOW;
    G.stats.bestCombo = Math.max(G.stats.bestCombo, G.combo);
    G.stats.nukes += 1;
    G.integrity = Math.min(100, G.integrity + 6);
    G.meter = 0;
    G.flashWhite = 0.9;
    G.shake = 24;
    el.nukeFx.classList.remove("fire");
    void el.nukeFx.offsetWidth;
    el.nukeFx.classList.add("fire");
    shockwave(view.w / 2, view.h / 2, COLORS.acid, Math.max(view.w, view.h));
    shockwave(view.w / 2, view.h / 2, COLORS.corrupt, Math.max(view.w, view.h) * 0.7);
    popup(view.w / 2, view.h / 2 - 60, `+${gained}`, COLORS.acid, 1.7);
    toast(`DELETE ALL // ${corrupt.length} FILES OBLITERATED`, "gold", 2400, true);
    sound.nuke();
    updateHud();
    if (G.quota >= G.cfg.quota) window.setTimeout(sectorComplete, 420);
  }

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------

  function pointFromEvent(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  canvas.addEventListener("pointerdown", (event) => {
    if (G.phase !== "playing") return;
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    const point = pointFromEvent(event);
    pointer.active = true;
    pointer.id = event.pointerId;
    pointer.x = point.x;
    pointer.y = point.y;
    pointer.sx = point.x;
    pointer.sy = point.y;
    pointer.moved = false;
    pointer.type = event.pointerType || "mouse";
    pointer.downAt = performance.now();
    pointer.inside = true;
    try { canvas.setPointerCapture(event.pointerId); } catch { /* no capture */ }
  });

  canvas.addEventListener("pointermove", (event) => {
    const point = pointFromEvent(event);
    pointer.x = point.x;
    pointer.y = point.y;
    pointer.type = event.pointerType || pointer.type;
    pointer.inside = point.x >= 0 && point.y >= 0 && point.x <= view.w && point.y <= view.h;
    if (pointer.active && event.pointerId === pointer.id) {
      const dx = point.x - pointer.sx;
      const dy = point.y - pointer.sy;
      if (Math.hypot(dx, dy) > 5) pointer.moved = true;
      if (pointer.moved) event.preventDefault();
    } else {
      const hit = G.phase === "playing" ? hitTest(point.x, point.y) : null;
      G.hovered = hit ? hit.id : null;
    }
  });

  function finishPointer(event) {
    if (!pointer.active || (event.pointerId !== undefined && event.pointerId !== pointer.id)) return;
    if (G.phase !== "playing") {
      pointer.active = false;
      return;
    }
    const point = pointFromEvent(event);
    const dx = point.x - pointer.sx;
    const dy = point.y - pointer.sy;
    const distance = Math.hypot(dx, dy);
    const elapsed = performance.now() - pointer.downAt;
    pointer.active = false;
    pointer.moved = false;
    G.selectionPreview = null;
    try { canvas.releasePointerCapture(event.pointerId); } catch { /* no capture */ }

    if (distance < 7 && elapsed < 380) {
      handleClick(point.x, point.y);
    } else if (distance >= 7) {
      handleBox({ x1: pointer.sx, y1: pointer.sy, x2: point.x, y2: point.y });
    }
  }

  canvas.addEventListener("pointerup", finishPointer);
  canvas.addEventListener("pointercancel", (event) => {
    pointer.active = false;
    pointer.moved = false;
    G.selectionPreview = null;
    try { canvas.releasePointerCapture(event.pointerId); } catch { /* no capture */ }
  });
  canvas.addEventListener("pointerleave", () => {
    if (!pointer.active) {
      pointer.inside = false;
      G.hovered = null;
    }
  });
  canvas.addEventListener("pointerenter", () => { pointer.inside = true; });
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());

  // ---------------------------------------------------------------------------
  // UI + modal controls
  // ---------------------------------------------------------------------------

  function openHowto() {
    el.howto.classList.remove("is-hidden");
    sound.click();
  }

  function closeHowto() {
    el.howto.classList.add("is-hidden");
    sound.click();
  }

  function updateHud(force = false) {
    const cfg = G.cfg;
    el.scoreValue.textContent = money(G.shownScore);
    const integrity = Math.ceil(G.integrity);
    el.integrityText.textContent = `${integrity}%`;
    el.integrityBar.style.width = `${clamp(G.integrity, 0, 100)}%`;
    el.purgeText.textContent = `${Math.min(G.quota, cfg.quota)} / ${cfg.quota}`;
    el.purgeBar.style.width = `${clamp((G.quota / cfg.quota) * 100, 0, 100)}%`;
    el.timeText.textContent = `${Math.max(0, G.timeLeft).toFixed(1)}`;
    el.timeBar.style.width = `${clamp((G.timeLeft / G.totalTime) * 100, 0, 100)}%`;
    el.integrityCell.classList.toggle("is-low", G.integrity < 30);
    el.timeCell.classList.toggle("is-low", G.timeLeft <= 10);
    el.comboMult.textContent = `×${comboMultiplier()}`;
    el.chain.classList.toggle("active", G.combo > 0);
    el.comboBar.style.width = `${clamp((G.comboTimer / COMBO_WINDOW) * 100, 0, 100)}%`;
    el.nukeCharge.style.width = `${clamp(G.meter, 0, 100)}%`;
    el.nukeBtn.disabled = !(G.meter >= 100 && G.phase === "playing");
    el.nukeHint.textContent = G.meter >= 100 ? "READY // OBLITERATE" : `CHARGE ${Math.floor(G.meter)}%`;
    if (force) el.scoreValue.textContent = money(G.score);
  }

  function updateEffects(dt) {
    for (const particle of G.particles) {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += particle.gravity * dt;
      particle.vx *= 0.992;
    }
    G.particles = G.particles.filter((particle) => particle.life > 0);

    for (const item of G.popups) {
      item.life -= dt;
      item.y -= 27 * dt;
    }
    G.popups = G.popups.filter((item) => item.life > 0);

    for (const ring of G.rings) {
      ring.life -= dt;
      ring.r = lerp(ring.r, ring.maxR, 1 - Math.pow(0.002, dt));
    }
    G.rings = G.rings.filter((ring) => ring.life > 0);

    G.shake = Math.max(0, G.shake - dt * 42);
    G.flashRed = Math.max(0, G.flashRed - dt * 2.1);
    G.flashWhite = Math.max(0, G.flashWhite - dt * 2.4);
    G.shownScore = lerp(G.shownScore, G.score, 1 - Math.pow(0.0005, dt));
    if (Math.abs(G.shownScore - G.score) < 0.4) G.shownScore = G.score;
  }

  function update(dt) {
    if (G.phase === "menu") return;

    if (G.phase === "playing") {
      G.timeLeft -= dt;
      G.runClock += dt;
      G.playClock += dt;
      if (!G.hintFade && G.playClock > 7) {
        G.hintFade = true;
        el.hint.classList.add("is-faded");
      }
      if (G.comboTimer > 0) {
        G.comboTimer -= dt;
        if (G.comboTimer <= 0) {
          G.combo = 0;
          G.comboTimer = 0;
        }
      }

      updateFiles(dt);

      G.spawnTimer -= dt;
      const corruptCount = G.files.filter((file) => file.corrupt).length;
      if (G.spawnTimer <= 0) {
        if (corruptCount < G.cfg.cap) {
          spawnCorrupt();
          G.spawnTimer = G.cfg.interval * rand(0.78, 1.18);
        } else {
          G.spawnTimer = 0.24;
        }
      }

      G.safeTimer -= dt;
      const safeCount = G.files.filter((file) => !file.corrupt).length;
      if (G.safeTimer <= 0) {
        if (safeCount < G.cfg.safeCap) {
          spawnSafe();
          G.safeTimer = rand(3.6, 5.4);
        } else {
          G.safeTimer = 0.5;
        }
      }

      if (G.timeLeft <= 0) {
        G.timeLeft = 0;
        failRun("PURGE WINDOW EXPIRED — THE CORRUPTION OUTLASTED YOU.");
      }
    } else if (G.phase === "sectorClear" || G.phase === "gameoverAnim") {
      updateFiles(dt);
      G.clearTimer -= dt;
      if (G.clearTimer <= 0) {
        if (G.phase === "sectorClear") {
          if (G.sectorIndex >= SECTORS.length - 1) showVictoryModal();
          else showSectorModal();
        } else {
          showGameOverModal();
        }
      }
    }

    updateEffects(dt);
    updateHud();
  }

  // ---------------------------------------------------------------------------
  // Event wiring + init
  // ---------------------------------------------------------------------------

  el.startBtn.addEventListener("click", startRun);
  el.howBtn.addEventListener("click", openHowto);
  el.howtoClose.addEventListener("click", closeHowto);
  el.pauseBtn.addEventListener("click", pauseGame);
  el.modalPrimary.addEventListener("click", handleModalPrimary);
  el.modalSecondary.addEventListener("click", handleModalSecondary);
  el.nukeBtn.addEventListener("click", activateNuke);
  el.soundBtn.addEventListener("click", () => sound.setEnabled(!sound.enabled));

  document.querySelectorAll("[data-sound-toggle]").forEach((button) => {
    button.addEventListener("click", () => sound.setEnabled(!sound.enabled));
  });

  document.addEventListener("keydown", (event) => {
    const tag = event.target?.tagName?.toLowerCase();
    if (tag === "input" || tag === "textarea") return;

    if (event.key === "m" || event.key === "M") {
      sound.setEnabled(!sound.enabled);
      return;
    }

    if (event.key === "Escape") {
      if (!el.howto.classList.contains("is-hidden")) {
        closeHowto();
        return;
      }
      if (G.phase === "modal" && G.modalKind === "pause") {
        resumeGame();
        return;
      }
      if (G.phase === "playing") {
        pauseGame();
        return;
      }
    }

    if (event.key === "Enter" && G.phase === "menu" && el.howto.classList.contains("is-hidden")) {
      if (event.target?.tagName?.toLowerCase() === "button") return;
      event.preventDefault();
      startRun();
      return;
    }

    if (event.key === "p" || event.key === "P") {
      if (G.phase === "playing") pauseGame();
      else if (G.phase === "modal" && G.modalKind === "pause") resumeGame();
      return;
    }

    if (event.code === "Space") {
      if (G.phase === "playing") {
        event.preventDefault();
        activateNuke();
      } else if (G.phase === "modal" && G.modalKind === "pause") {
        event.preventDefault();
        resumeGame();
      }
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && G.phase === "playing") pauseGame();
  });

  if ("ResizeObserver" in window) {
    const observer = new ResizeObserver(() => resizeCanvas());
    observer.observe(el.arena);
  } else {
    window.addEventListener("resize", resizeCanvas);
  }
  window.addEventListener("resize", resizeCanvas);

  window.setInterval(() => {
    const stamp = clockString();
    if (el.menuClock) el.menuClock.textContent = stamp;
    if (el.howtoClock) el.howtoClock.textContent = stamp;
    if (el.modalClock) el.modalClock.textContent = stamp;
  }, 500);

  // ---------------------------------------------------------------------------
  // Main loop
  // ---------------------------------------------------------------------------

  let previousTime = performance.now();

  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - previousTime) / 1000));
    previousTime = now;
    G.clock += dt;

    update(dt);
    if (G.phase !== "menu") draw();
    requestAnimationFrame(frame);
  }

  function init() {
    el.bestScore.textContent = money(G.best);
    document.body.classList.toggle("is-muted", !sound.enabled);
    if (el.soundBtn) el.soundBtn.setAttribute("aria-label", sound.enabled ? "Mute sound" : "Unmute sound");
    document.querySelectorAll("[data-sound-toggle]").forEach((button) => {
      button.setAttribute("aria-pressed", String(sound.enabled));
    });
    resizeCanvas();
    requestAnimationFrame(frame);
    window.setTimeout(() => {
      if (G.phase === "menu") el.startBtn.focus({ preventScroll: true });
    }, 900);
  }

  // Debug hook used by the automated browser checks.
  window.__DELETE_ALL__ = {
    get state() {
      return {
        phase: G.phase,
        sector: G.sectorIndex + 1,
        score: Math.floor(G.score),
        integrity: G.integrity,
        quota: G.quota,
        target: G.cfg.quota,
        timeLeft: G.timeLeft,
        meter: G.meter,
        combo: G.combo,
        files: G.files.length,
        corrupt: G.files.filter((file) => file.corrupt).length,
        safe: G.files.filter((file) => !file.corrupt).length
      };
    },
    filesInfo() {
      return G.files.map((file) => ({
        id: file.id,
        corrupt: file.corrupt,
        variant: file.variant,
        x: Math.round(file.x + file.w / 2),
        y: Math.round(file.y + file.h / 2),
        w: Math.round(file.w),
        h: Math.round(file.h),
        hp: file.hp
      }));
    },
    start: startRun,
    nuke: activateNuke,
    pause: pauseGame,
    resume: resumeGame,
    setMeter(value) { G.meter = clamp(value, 0, 100); updateHud(true); },
    damage(value) {
      G.integrity = clamp(G.integrity - value, 0, 100);
      if (G.integrity <= 0) failRun("INTEGRITY DEPLETED — TEST SIGNAL LOST.");
      updateHud();
    },
    clearSector() {
      if (G.phase === "playing") {
        G.quota = G.cfg.quota;
        sectorComplete();
      }
    },
    victory() {
      G.score = Math.max(G.score, 42850);
      G.stats.deleted = Math.max(G.stats.deleted, 142);
      G.stats.bestCombo = Math.max(G.stats.bestCombo, 29);
      G.sectorIndex = SECTORS.length - 1;
      G.runClock = 158;
      showVictoryModal();
    },
    spawn(type = "worm") {
      if (G.phase !== "playing") return null;
      const file = corruptFile(type);
      const spot = findOpenPosition(file.w, file.h);
      file.x = spot.x;
      file.y = spot.y;
      G.files.push(file);
      return file.id;
    }
  };

  init();

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  function draw() {
    if (!view.w || !view.h) return;
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.clearRect(0, 0, view.w, view.h);

    if (pointer.active && pointer.moved) {
      const rect = { x1: pointer.sx, y1: pointer.sy, x2: pointer.x, y2: pointer.y };
      const contents = selectionContents(rect);
      G.selectionPreview = {
        rect,
        corrupt: new Set(contents.corrupt.map((file) => file.id)),
        safe: new Set(contents.safe.map((file) => file.id))
      };
    } else {
      G.selectionPreview = null;
    }

    ctx.save();
    if (G.shake > 0.1 && !REDUCED_MOTION) {
      ctx.translate(rand(-1, 1) * G.shake * 0.3, rand(-1, 1) * G.shake * 0.3);
    }

    drawBackground();
    drawFiles();
    drawParticles();
    drawRings();
    drawSelectionPreview();
    drawPopups();
    drawCursor();
    ctx.restore();

    drawOverlays();
  }

  function drawBackground() {
    if (!view.bg) return;
    const w = view.w;
    const h = view.h;
    ctx.fillStyle = view.bg;
    ctx.fillRect(0, 0, w, h);

    const grid = 46;
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(201,255,61,0.032)";
    ctx.beginPath();
    for (let x = (G.clock * 2) % grid; x < w; x += grid) {
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, h);
    }
    for (let y = (G.clock * 1.2) % grid; y < h; y += grid) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(w, y + 0.5);
    }
    ctx.stroke();

    ctx.strokeStyle = "rgba(201,255,61,0.065)";
    ctx.beginPath();
    for (let x = 0; x < w; x += grid * 4) {
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, h);
    }
    for (let y = 0; y < h; y += grid * 4) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(w, y + 0.5);
    }
    ctx.stroke();

    // Huge ghost sector numeral in the middle of the playfield.
    ctx.globalAlpha = 0.028;
    ctx.fillStyle = COLORS.acid;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${Math.max(130, Math.min(w, h) * 0.64)}px "Archivo Black", sans-serif`;
    ctx.fillText(pad2(G.sectorIndex + 1), w / 2, h * 0.55);

    // Slow-moving data rain.
    ctx.font = "9px 'Space Mono', monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    for (const bit of G.bgBits) {
      const x = bit.x * w;
      const y = ((bit.y * h + G.clock * bit.drift + h) % h);
      ctx.globalAlpha = bit.alpha;
      ctx.fillStyle = bit.bit === "1" ? COLORS.safe : COLORS.acid;
      ctx.fillText(bit.bit, x, y);
    }

    // A single scanning line keeps the desktop alive.
    const sweep = (G.clock * 24) % (h + 140) - 70;
    const sweepGradient = ctx.createLinearGradient(0, sweep - 35, 0, sweep + 35);
    sweepGradient.addColorStop(0, "rgba(201,255,61,0)");
    sweepGradient.addColorStop(0.5, "rgba(201,255,61,0.032)");
    sweepGradient.addColorStop(1, "rgba(201,255,61,0)");
    ctx.globalAlpha = 1;
    ctx.fillStyle = sweepGradient;
    ctx.fillRect(0, sweep - 35, w, 70);

    // Corner ticks.
    ctx.globalAlpha = 0.32;
    ctx.strokeStyle = COLORS.acid;
    ctx.lineWidth = 1;
    const corner = 13;
    const inset = 18;
    ctx.beginPath();
    ctx.moveTo(inset, inset + corner); ctx.lineTo(inset, inset); ctx.lineTo(inset + corner, inset);
    ctx.moveTo(w - inset - corner, inset); ctx.lineTo(w - inset, inset); ctx.lineTo(w - inset, inset + corner);
    ctx.moveTo(inset, h - inset - corner); ctx.lineTo(inset, h - inset); ctx.lineTo(inset + corner, h - inset);
    ctx.moveTo(w - inset - corner, h - inset); ctx.lineTo(w - inset, h - inset); ctx.lineTo(w - inset, h - inset - corner);
    ctx.stroke();

    ctx.restore();
  }

  function drawFiles() {
    const t = G.clock;
    const files = G.files;
    for (const file of files) drawFile(file, t);
  }

  function drawFile(file, time) {
    const preview = G.selectionPreview;
    const inCorrupt = preview?.corrupt.has(file.id);
    const inSafe = preview?.safe.has(file.id);
    const hovered = G.hovered === file.id && !pointer.active;
    const spawn = clamp(file.spawnT / 0.3, 0, 1);
    const ease = 1 - Math.pow(1 - spawn, 3);
    const wobble = Math.sin(time * 1.35 + file.seed) * 1.15;
    const w = file.w;
    const h = file.h;
    const x = file.x;
    const y = file.y + wobble;
    const accent = file.corrupt ? COLORS.corrupt : COLORS.safe;
    const selected = inCorrupt || inSafe;

    ctx.save();
    ctx.globalAlpha = ease;
    ctx.translate(x + w / 2, y + h / 2);
    const scale = 0.84 + ease * 0.16;
    ctx.scale(scale, scale);
    ctx.translate(-w / 2, -h / 2);

    if (selected || hovered) {
      ctx.shadowColor = inSafe ? COLORS.corrupt : accent;
      ctx.shadowBlur = selected ? 23 : 12;
    } else {
      ctx.shadowColor = file.corrupt ? "rgba(255,79,99,0.12)" : "rgba(67,230,211,0.1)";
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 5;
    }

    const body = ctx.createLinearGradient(0, 0, 0, h);
    if (file.corrupt) {
      body.addColorStop(0, "#251017");
      body.addColorStop(0.55, "#160b0f");
      body.addColorStop(1, "#0d0709");
    } else {
      body.addColorStop(0, "#0c2526");
      body.addColorStop(0.55, "#081719");
      body.addColorStop(1, "#061012");
    }
    roundRect(0, 0, w, h, 5);
    ctx.fillStyle = body;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    ctx.lineWidth = selected ? 1.8 : 1;
    ctx.strokeStyle = inSafe ? COLORS.corrupt : selected ? COLORS.acid : hovered ? "rgba(237,247,238,0.75)" : accent;
    ctx.globalAlpha = ease * (selected || hovered ? 1 : 0.64);
    ctx.stroke();
    ctx.globalAlpha = ease;

    // Header strip.
    const headerH = Math.max(13, h * 0.17);
    roundRect(0, 0, w, headerH, 5);
    ctx.fillStyle = file.corrupt ? "rgba(255,79,99,0.13)" : "rgba(67,230,211,0.11)";
    ctx.fill();
    ctx.fillStyle = file.corrupt ? "rgba(255,79,99,0.15)" : "rgba(67,230,211,0.1)";
    ctx.fillRect(0, headerH - 1, w, 1);

    const dotY = headerH / 2;
    const dotColors = file.corrupt
      ? ["rgba(255,79,99,0.7)", "rgba(255,79,99,0.4)", "rgba(255,79,99,0.22)"]
      : ["rgba(67,230,211,0.7)", "rgba(67,230,211,0.4)", "rgba(67,230,211,0.22)"];
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.arc(7 + i * 5, dotY, 1.25, 0, Math.PI * 2);
      ctx.fillStyle = dotColors[i];
      ctx.fill();
    }

    // Status tag.
    const tag = file.variant === "rootkit" ? `${file.hp}HP` : file.variant === "bomb" ? "BMB" : file.corrupt ? "!!" : "SYS";
    ctx.font = `700 ${Math.max(5.2, w * 0.083)}px 'Space Mono', monospace`;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillStyle = file.corrupt ? COLORS.corrupt : COLORS.safe;
    ctx.globalAlpha = ease * 0.9;
    ctx.fillText(tag, w - 6, dotY + 0.5);
    ctx.globalAlpha = ease;

    // Document icon.
    const iconW = w * 0.34;
    const iconH = h * 0.36;
    const ix = w / 2 - iconW / 2;
    const iy = headerH + h * 0.09;
    ctx.strokeStyle = accent;
    ctx.globalAlpha = ease * 0.78;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(ix, iy);
    ctx.lineTo(ix + iconW * 0.68, iy);
    ctx.lineTo(ix + iconW, iy + iconH * 0.26);
    ctx.lineTo(ix + iconW, iy + iconH);
    ctx.lineTo(ix, iy + iconH);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ix + iconW * 0.68, iy);
    ctx.lineTo(ix + iconW * 0.68, iy + iconH * 0.26);
    ctx.lineTo(ix + iconW, iy + iconH * 0.26);
    ctx.stroke();
    ctx.lineWidth = 0.8;
    ctx.globalAlpha = ease * 0.44;
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.moveTo(ix + iconW * 0.15, iy + iconH * (0.48 + i * 0.17));
      ctx.lineTo(ix + iconW * (0.75 - i * 0.1), iy + iconH * (0.48 + i * 0.17));
      ctx.stroke();
    }

    // Rootkit armor pips.
    if (file.variant === "rootkit") {
      const pipY = h * 0.62;
      const pipW = w * 0.15;
      for (let i = 0; i < 2; i += 1) {
        ctx.fillStyle = file.hp > i ? COLORS.amber : "rgba(255,209,102,0.18)";
        ctx.fillRect(w / 2 - pipW - 2 + i * (pipW + 4), pipY, pipW, 2);
      }
    }

    // Bomb fuse.
    if (file.variant === "bomb" && file.fuse > 0) {
      const ratio = clamp(file.fuse / file.fuseMax, 0, 1);
      const pulse = file.fuse < 3 ? 0.55 + Math.sin(time * 18) * 0.35 : 0.85;
      const bx = w - 10;
      const by = h * 0.6;
      ctx.globalAlpha = ease * pulse;
      ctx.strokeStyle = file.fuse < 3 ? COLORS.corrupt : COLORS.amber;
      ctx.lineWidth = 1.7;
      ctx.beginPath();
      ctx.arc(bx, by, 5.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio);
      ctx.stroke();
      ctx.font = `700 ${Math.max(5, w * 0.072)}px 'Space Mono', monospace`;
      ctx.textAlign = "center";
      ctx.fillStyle = file.fuse < 3 ? COLORS.corrupt : COLORS.amber;
      ctx.fillText(Math.ceil(file.fuse), bx, by + 0.5);
      ctx.globalAlpha = ease;
    }

    // Filename + extension.
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = file.corrupt ? "#ffd9dc" : "#d9fffa";
    const nameSize = Math.max(5.4, w * 0.084);
    ctx.font = `700 ${nameSize}px 'Space Mono', monospace`;
    ctx.globalAlpha = ease * 0.92;
    ctx.fillText(fitText(file.name, w - 10), w / 2, h - 13);
    ctx.font = `${Math.max(4.8, w * 0.066)}px 'Space Mono', monospace`;
    ctx.fillStyle = file.corrupt ? "rgba(255,79,99,0.62)" : "rgba(67,230,211,0.55)";
    ctx.fillText(file.ext, w / 2, h - 5.5);
    ctx.globalAlpha = ease;

    // Corrupt card glitch bars.
    if (file.corrupt && !REDUCED_MOTION) {
      const pulse = Math.sin(time * 5.7 + file.seed);
      if (pulse > 0.42) {
        const gy = headerH + (h - headerH) * (0.24 + ((Math.sin(file.seed * 1.7) + 1) * 0.28));
        ctx.fillStyle = "rgba(255,79,99,0.13)";
        ctx.fillRect(4 + pulse * 5, gy, w - 8 - pulse * 7, 1.5);
        ctx.fillStyle = "rgba(237,247,238,0.06)";
        ctx.fillRect(w * 0.16, gy + 4, w * 0.4, 1);
      }
      ctx.strokeStyle = "rgba(255,79,99,0.09)";
      ctx.lineWidth = 1;
      for (let sy = headerH + 3; sy < h; sy += 4) {
        ctx.beginPath();
        ctx.moveTo(2, sy + 0.5);
        ctx.lineTo(w - 2, sy + 0.5);
        ctx.stroke();
      }
    }

    // Armor crack.
    if (file.cracked) {
      ctx.strokeStyle = "rgba(255,209,102,0.75)";
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(w * 0.34, h * 0.28);
      ctx.lineTo(w * 0.48, h * 0.47);
      ctx.lineTo(w * 0.39, h * 0.61);
      ctx.lineTo(w * 0.52, h * 0.78);
      ctx.stroke();
    }

    if (selected) {
      ctx.strokeStyle = inSafe ? COLORS.corrupt : COLORS.acid;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.9;
      roundRect(-3, -3, w + 6, h + 6, 7);
      ctx.stroke();
      const bracket = 5;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-4, -4 + bracket); ctx.lineTo(-4, -4); ctx.lineTo(-4 + bracket, -4);
      ctx.moveTo(w + 4 - bracket, -4); ctx.lineTo(w + 4, -4); ctx.lineTo(w + 4, -4 + bracket);
      ctx.moveTo(-4, h + 4 - bracket); ctx.lineTo(-4, h + 4); ctx.lineTo(-4 + bracket, h + 4);
      ctx.moveTo(w + 4 - bracket, h + 4); ctx.lineTo(w + 4, h + 4); ctx.lineTo(w + 4, h + 4 - bracket);
      ctx.stroke();
    }

    if (file.flash > 0) {
      roundRect(0, 0, w, h, 5);
      ctx.fillStyle = `rgba(255,255,255,${file.flash * 0.5})`;
      ctx.fill();
    }

    ctx.restore();
  }

  function drawParticles() {
    for (const particle of G.particles) {
      const alpha = clamp(particle.life / particle.maxLife, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawRings() {
    for (const ring of G.rings) {
      const alpha = clamp(ring.life / ring.maxLife, 0, 1);
      ctx.globalAlpha = alpha * 0.55;
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = 1 + alpha * 2;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawPopups() {
    for (const item of G.popups) {
      const progress = 1 - item.life / item.maxLife;
      const alpha = clamp(item.life / item.maxLife, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = item.color;
      ctx.shadowColor = item.color;
      ctx.shadowBlur = 12;
      const size = Math.round(19 * item.size * (1 + Math.max(0, 0.14 - progress)));
      ctx.font = `${size}px "Archivo Black", sans-serif`;
      ctx.fillText(item.text, item.x, item.y);
      ctx.restore();
    }
  }

  function drawSelectionPreview() {
    const preview = G.selectionPreview;
    if (!preview) return;
    const { x1, y1, x2, y2 } = preview.rect;
    const left = Math.min(x1, x2);
    const top = Math.min(y1, y2);
    const width = Math.abs(x2 - x1);
    const height = Math.abs(y2 - y1);
    if (width < 4 && height < 4) return;
    const hasSafe = preview.safe.size > 0;
    const color = hasSafe ? COLORS.corrupt : COLORS.acid;

    ctx.save();
    ctx.fillStyle = hasSafe ? "rgba(255,79,99,0.075)" : "rgba(201,255,61,0.06)";
    ctx.fillRect(left, top, width, height);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([6, 5]);
    ctx.lineDashOffset = -G.clock * 20;
    ctx.strokeRect(left + 0.5, top + 0.5, width, height);
    ctx.setLineDash([]);

    const corner = Math.min(9, width / 2, height / 2);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(left, top + corner); ctx.lineTo(left, top); ctx.lineTo(left + corner, top);
    ctx.moveTo(left + width - corner, top); ctx.lineTo(left + width, top); ctx.lineTo(left + width, top + corner);
    ctx.moveTo(left, top + height - corner); ctx.lineTo(left, top + height); ctx.lineTo(left + corner, top + height);
    ctx.moveTo(left + width - corner, top + height); ctx.lineTo(left + width, top + height); ctx.lineTo(left + width, top + height - corner);
    ctx.stroke();

    const label = `${preview.corrupt.size} TARGET${preview.corrupt.size === 1 ? "" : "S"}${hasSafe ? ` · ${preview.safe.size} SYSTEM` : ""}`;
    ctx.font = "700 7px 'Space Mono', monospace";
    const labelWidth = ctx.measureText(label).width + 12;
    const labelY = top > 22 ? top - 17 : top + 3;
    ctx.fillStyle = "rgba(5,10,12,0.9)";
    ctx.fillRect(left, labelY, labelWidth, 14);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(left + 0.5, labelY + 0.5, labelWidth, 13);
    ctx.fillStyle = color;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(label, left + 6, labelY + 7);
    ctx.restore();
  }

  function drawCursor() {
    if (!pointer.inside || pointer.type !== "mouse") return;
    const x = pointer.x;
    const y = pointer.y;
    const hovered = G.hovered != null;
    ctx.save();
    ctx.strokeStyle = hovered ? COLORS.corrupt : COLORS.acid;
    ctx.fillStyle = hovered ? COLORS.corrupt : COLORS.acid;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.9;
    const gap = hovered ? 7 : 5;
    const arm = hovered ? 9 : 7;
    ctx.beginPath();
    ctx.moveTo(x - gap - arm, y + 0.5); ctx.lineTo(x - gap, y + 0.5);
    ctx.moveTo(x + gap, y + 0.5); ctx.lineTo(x + gap + arm, y + 0.5);
    ctx.moveTo(x + 0.5, y - gap - arm); ctx.lineTo(x + 0.5, y - gap);
    ctx.moveTo(x + 0.5, y + gap); ctx.lineTo(x + 0.5, y + gap + arm);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + 0.5, y + 0.5, 1.2, 0, Math.PI * 2);
    ctx.fill();
    if (hovered) {
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(x + 0.5, y + 0.5, 13, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawOverlays() {
    if (G.flashRed > 0) {
      ctx.fillStyle = `rgba(255,79,99,${G.flashRed * 0.16})`;
      ctx.fillRect(0, 0, view.w, view.h);
    }
    if (G.flashWhite > 0) {
      ctx.fillStyle = `rgba(231,255,207,${G.flashWhite * 0.24})`;
      ctx.fillRect(0, 0, view.w, view.h);
    }
    if (G.integrity < 30 && G.phase !== "menu") {
      const pulse = 0.04 + Math.sin(G.clock * 4) * 0.018;
      const gradient = ctx.createRadialGradient(view.w / 2, view.h / 2, view.h * 0.25, view.w / 2, view.h / 2, Math.max(view.w, view.h) * 0.72);
      gradient.addColorStop(0, "rgba(255,79,99,0)");
      gradient.addColorStop(1, `rgba(255,79,99,${Math.max(0.03, pulse)})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, view.w, view.h);
    }
  }

  // __APPEND__
})();
