// Synthesized WebAudio SFX — no external assets.
class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
  }
  ensure() {
    if (this.ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
      return true;
    } catch (e) { return false; }
  }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.55; }
  now() { return this.ctx.currentTime; }

  _noiseBuffer(dur) {
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    return buf;
  }
  _env(gainNode, t0, peak, attack, decay) {
    const g = gainNode.gain;
    g.setValueAtTime(0.0001, t0);
    g.linearRampToValueAtTime(peak, t0 + attack);
    g.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  }
  _noise(dur, { type = 'lowpass', freq = 800, q = 0.8, peak = 0.5, attack = 0.005, decay = 0.3, sweepTo = null } = {}) {
    if (!this.ensure() || this.muted) return;
    const t0 = this.now();
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(dur);
    const filter = this.ctx.createBiquadFilter();
    filter.type = type; filter.Q.value = q;
    filter.frequency.setValueAtTime(freq, t0);
    if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
    const gain = this.ctx.createGain();
    this._env(gain, t0, peak, attack, decay);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t0); src.stop(t0 + dur + 0.05);
  }
  _tone(freq, dur, { type = 'sine', peak = 0.4, attack = 0.005, decay = 0.4, sweepTo = null, delay = 0 } = {}) {
    if (!this.ensure() || this.muted) return;
    const t0 = this.now() + delay;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (sweepTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, sweepTo), t0 + dur);
    const gain = this.ctx.createGain();
    this._env(gain, t0, peak, attack, decay);
    osc.connect(gain).connect(this.master);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
  }

  rifle() { this._noise(0.12, { type: 'bandpass', freq: 1500, q: 1.2, peak: 0.35, decay: 0.09 }); this._tone(220, 0.06, { type: 'square', peak: 0.08, decay: 0.05 }); }
  reconShot() { this._noise(0.1, { type: 'bandpass', freq: 1800, q: 1.4, peak: 0.3, decay: 0.08 }); }
  cannon() { this._tone(72, 0.5, { type: 'sine', peak: 0.85, sweepTo: 34, decay: 0.45 }); this._noise(0.5, { freq: 420, peak: 0.6, decay: 0.42, sweepTo: 60 }); }
  artyFire() { this._tone(55, 0.65, { type: 'sine', peak: 0.9, sweepTo: 28, decay: 0.6 }); this._noise(0.7, { freq: 300, peak: 0.7, decay: 0.6, sweepTo: 45 }); }
  whistle() { this._tone(1150, 1.15, { type: 'sine', peak: 0.12, sweepTo: 290, decay: 1.1, attack: 0.15 }); }
  explosion(big = false) {
    if (big) {
      this._noise(1.4, { freq: 500, peak: 0.95, decay: 1.3, sweepTo: 40 });
      this._tone(48, 1.1, { type: 'sine', peak: 0.9, sweepTo: 22, decay: 1.0 });
    } else {
      this._noise(0.7, { freq: 700, peak: 0.6, decay: 0.6, sweepTo: 70 });
      this._tone(70, 0.55, { type: 'sine', peak: 0.55, sweepTo: 32, decay: 0.5 });
    }
  }
  hit() { this._noise(0.15, { type: 'bandpass', freq: 900, q: 2, peak: 0.32, decay: 0.12 }); }
  riccochet() { this._tone(1900, 0.18, { type: 'triangle', peak: 0.1, sweepTo: 2600, decay: 0.16 }); }
  uiClick() { this._tone(1300, 0.05, { type: 'square', peak: 0.07, decay: 0.04 }); }
  build() { this._noise(0.12, { type: 'bandpass', freq: 2400, q: 4, peak: 0.2, decay: 0.1 }); this._tone(320, 0.28, { type: 'square', peak: 0.12, decay: 0.25, delay: 0.08 }); }
  capture() { this._tone(523, 0.22, { type: 'sine', peak: 0.28, decay: 0.2 }); this._tone(784, 0.3, { type: 'sine', peak: 0.28, decay: 0.3, delay: 0.16 }); this._tone(1046, 0.45, { type: 'sine', peak: 0.24, decay: 0.42, delay: 0.32 }); }
  alarm() { this._tone(392, 0.16, { type: 'square', peak: 0.16, decay: 0.14 }); this._tone(392, 0.16, { type: 'square', peak: 0.16, decay: 0.14, delay: 0.24 }); }
  victory() { [523, 659, 784, 1046].forEach((f, i) => this._tone(f, 0.4, { type: 'triangle', peak: 0.3, decay: 0.38, delay: i * 0.18 })); }
  defeat() { [392, 349, 311, 233].forEach((f, i) => this._tone(f, 0.5, { type: 'triangle', peak: 0.28, decay: 0.48, delay: i * 0.22 })); }
  engine() { this._tone(38, 0.8, { type: 'sawtooth', peak: 0.06, sweepTo: 46, decay: 0.75, attack: 0.2 }); }
}

export const audio = new AudioEngine();
