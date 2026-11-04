export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.noise = null;
    this.lastShot = 0;
    this.ambientTimer = 0;
    this.started = false;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? 0.42 : 0;
    this.master.connect(this.ctx.destination);
    this.noise = this.makeNoise(2);
    this.started = true;
    this.startAmbience();
  }

  makeNoise(seconds) {
    const length = Math.floor(this.ctx.sampleRate * seconds);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = last * 0.96 + white * 0.04;
      data[i] = last * 2.4;
    }
    return buffer;
  }

  startAmbience() {
    if (!this.ctx) return;
    const source = this.ctx.createBufferSource();
    source.buffer = this.noise;
    source.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.045;
    source.connect(filter).connect(gain).connect(this.master);
    source.start();
    this.wind = { source, gain, filter };

    const rumble = this.ctx.createOscillator();
    const rumbleGain = this.ctx.createGain();
    rumble.type = 'sine';
    rumble.frequency.value = 34;
    rumbleGain.gain.value = 0.018;
    rumble.connect(rumbleGain).connect(this.master);
    rumble.start();
    this.rumble = { oscillator: rumble, gain: rumbleGain };
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (this.master) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.linearRampToValueAtTime(enabled ? 0.42 : 0, this.ctx.currentTime + 0.2);
    }
  }

  tone(freq, duration, type = 'sine', volume = 0.1, delay = 0) {
    if (!this.ctx || !this.enabled) return;
    const start = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain).connect(this.master);
    osc.start(start);
    osc.stop(start + duration + 0.03);
  }

  noiseBurst(duration, volume, filterFreq, delay = 0) {
    if (!this.ctx || !this.enabled) return;
    const start = this.ctx.currentTime + delay;
    const source = this.ctx.createBufferSource();
    source.buffer = this.noise;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, start);
    filter.frequency.exponentialRampToValueAtTime(90, start + duration);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter).connect(gain).connect(this.master);
    source.start(start);
    source.stop(start + duration + 0.02);
  }

  shot(type = 'rifle', intensity = 1) {
    if (!this.ctx || !this.enabled) return;
    const now = performance.now();
    const minimumGap = type === 'mg' ? 45 : 55;
    if (now - this.lastShot < minimumGap) return;
    this.lastShot = now;
    if (type === 'mg') {
      this.noiseBurst(0.08, 0.06 * intensity, 2200);
      this.tone(105, 0.05, 'square', 0.025);
    } else if (type === 'cannon' || type === 'tank') {
      this.noiseBurst(0.46, 0.22 * intensity, 1400);
      this.tone(48, 0.42, 'sine', 0.16);
      this.tone(88, 0.2, 'triangle', 0.07);
    } else if (type === 'art') {
      this.noiseBurst(0.7, 0.18 * intensity, 900);
      this.tone(40, 0.72, 'sine', 0.15);
    } else {
      this.noiseBurst(0.16, 0.12 * intensity, 2600);
      this.tone(132, 0.09, 'triangle', 0.035);
    }
  }

  explosion(intensity = 1) {
    if (!this.ctx || !this.enabled) return;
    this.noiseBurst(0.8, 0.22 * intensity, 1400);
    this.tone(34, 0.7, 'sine', 0.18 * intensity);
    this.tone(52, 0.5, 'triangle', 0.08);
  }

  click() {
    this.tone(780, 0.035, 'square', 0.018);
  }

  command() {
    this.tone(410, 0.06, 'triangle', 0.045);
    this.tone(620, 0.05, 'triangle', 0.032, 0.035);
  }

  capture(win = true) {
    const notes = win ? [392, 523, 659] : [330, 262];
    notes.forEach((note, index) => this.tone(note, 0.28, 'sine', 0.06, index * 0.1));
  }

  alarm() {
    this.tone(220, 0.2, 'sawtooth', 0.03);
    this.tone(196, 0.3, 'sawtooth', 0.025, 0.22);
  }

  update(dt, intensity = 0.4) {
    if (!this.ctx || !this.enabled) return;
    this.ambientTimer -= dt;
    if (this.ambientTimer <= 0) {
      this.ambientTimer = 4 + Math.random() * 9;
      const distance = 0.05 + Math.random() * 0.06;
      this.noiseBurst(0.9 + Math.random() * 0.7, distance * intensity, 700);
      this.tone(38 + Math.random() * 18, 0.9, 'sine', 0.04 * intensity);
    }
  }
}
