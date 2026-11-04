// Procedural ambience — wind, birdsong by day, crickets by night, campfire crackle.
// No audio assets; everything is synthesized with Web Audio.
class Ambience {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.nightF = 0;
    this.fireProximity = 0; // 0..1
    this._birdTimer = null;
    this._crackleTimer = null;
  }

  start() {
    if (this.ctx) { this.ctx.resume?.(); return; }
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.55;
      this.master.connect(ctx.destination);

      // ---- Wind: looped noise → lowpass, slowly breathing ----
      const noiseBuf = this._makeNoiseBuffer(2.5);
      const windSrc = ctx.createBufferSource();
      windSrc.buffer = noiseBuf; windSrc.loop = true;
      const windFilter = ctx.createBiquadFilter();
      windFilter.type = 'lowpass'; windFilter.frequency.value = 420; windFilter.Q.value = 0.8;
      const windGain = ctx.createGain(); windGain.gain.value = 0.16;
      // Slow LFO on the filter cutoff for gusts
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
      const lfoGain = ctx.createGain(); lfoGain.gain.value = 190;
      lfo.connect(lfoGain); lfoGain.connect(windFilter.frequency);
      windSrc.connect(windFilter); windFilter.connect(windGain); windGain.connect(this.master);
      windSrc.start(); lfo.start();
      this._windGain = windGain;

      // ---- Leafy rustle: noise → bandpass around 2.2 kHz, very quiet ----
      const rustleSrc = ctx.createBufferSource();
      rustleSrc.buffer = noiseBuf; rustleSrc.loop = true; rustleSrc.playbackRate.value = 1.7;
      const rustleFilter = ctx.createBiquadFilter();
      rustleFilter.type = 'bandpass'; rustleFilter.frequency.value = 2300; rustleFilter.Q.value = 0.6;
      const rustleGain = ctx.createGain(); rustleGain.gain.value = 0.018;
      rustleSrc.connect(rustleFilter); rustleFilter.connect(rustleGain); rustleGain.connect(this.master);
      rustleSrc.start();

      this._scheduleBirds();
      this._scheduleCrackle();
    } catch (e) {
      console.warn('Ambience unavailable:', e);
    }
  }

  _makeNoiseBuffer(seconds) {
    const ctx = this.ctx;
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      // pinkish noise
      const white = Math.random() * 2 - 1;
      last = last * 0.94 + white * 0.06;
      data[i] = last * 3.2;
    }
    return buf;
  }

  _scheduleBirds() {
    const chirp = () => {
      this._birdTimer = setTimeout(chirp, 1200 + Math.random() * 4200);
      if (!this.ctx || this.muted) return;
      if (this.nightF > 0.55) {
        this._cricket();
        return;
      }
      const ctx = this.ctx, t = ctx.currentTime;
      const notes = 2 + ((Math.random() * 3) | 0);
      for (let i = 0; i < notes; i++) {
        const t0 = t + i * (0.09 + Math.random() * 0.08);
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        const f0 = 2100 + Math.random() * 1500;
        osc.frequency.setValueAtTime(f0, t0);
        osc.frequency.exponentialRampToValueAtTime(f0 * (1.15 + Math.random() * 0.35), t0 + 0.035);
        osc.frequency.exponentialRampToValueAtTime(f0 * 0.82, t0 + 0.09);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(0.05 + Math.random() * 0.035, t0 + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.1);
        osc.connect(g); g.connect(this.master);
        osc.start(t0); osc.stop(t0 + 0.12);
      }
    };
    this._birdTimer = setTimeout(chirp, 700);
  }

  _cricket() {
    const ctx = this.ctx, t = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const t0 = t + i * 0.07;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = 4300 + Math.random() * 250;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.028, t0 + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05);
      osc.connect(g); g.connect(this.master);
      osc.start(t0); osc.stop(t0 + 0.06);
    }
  }

  _scheduleCrackle() {
    const crackle = () => {
      this._crackleTimer = setTimeout(crackle, 90 + Math.random() * 480);
      if (!this.ctx || this.muted || this.fireProximity <= 0.04) return;
      const ctx = this.ctx, t = ctx.currentTime;
      // short burst of band-passed noise = pop
      const src = ctx.createBufferSource();
      src.buffer = this._makeNoiseBuffer(0.06);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 600 + Math.random() * 1500;
      bp.Q.value = 1.4;
      const g = ctx.createGain();
      const amp = (0.05 + Math.random() * 0.09) * this.fireProximity;
      g.gain.setValueAtTime(amp, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);
      src.connect(bp); bp.connect(g); g.connect(this.master);
      src.start(t); src.stop(t + 0.07);
    };
    this._crackleTimer = setTimeout(crackle, 300);
  }

  /** Soft footfall — call on head-bob steps */
  footstep(intensity = 0.5) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this._noiseOnce || (this._noiseOnce = this._makeNoiseBuffer(0.09));
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 300 + Math.random() * 380;
    bp.Q.value = 0.9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.10 * intensity + 0.03, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.085);
    src.connect(bp); bp.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + 0.09);
  }

  setNight(f) { this.nightF = f; }
  setFireProximity(p) { this.fireProximity = Math.max(0, Math.min(1, p)); }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.55, this.ctx.currentTime, 0.1);
    }
    return this.muted;
  }
}

export const ambience = new Ambience();
