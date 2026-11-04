// BROKEN LINE — procedural combat audio. No external samples.
export class CombatAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noise = null;
    this.muted = false;
    this.ambientStarted = false;
    this.volume = 0.52;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    const compressor = this.ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 14;
    compressor.ratio.value = 7;
    compressor.attack.value = 0.002;
    compressor.release.value = 0.16;
    compressor.connect(this.ctx.destination);

    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    this.master.connect(compressor);

    // 2.5 seconds of white noise, reused for every impact and shot.
    const len = Math.floor(this.ctx.sampleRate * 2.5);
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noise = buffer;
  }

  setMuted(value) {
    this.muted = value;
    if (this.master) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.linearRampToValueAtTime(value ? 0 : this.volume, this.ctx.currentTime + 0.08);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  noiseSource() {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    return src;
  }

  gainNode(value, pan = 0) {
    const gain = this.ctx.createGain();
    gain.gain.value = value;
    if (pan && this.ctx.createStereoPanner) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = Math.max(-0.9, Math.min(0.9, pan));
      gain.connect(panner);
      panner.connect(this.master);
    } else {
      gain.connect(this.master);
    }
    return gain;
  }

  tone(freq, duration, type = 'sine', volume = 0.1, slideTo = null, pan = 0, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.now() + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.gainNode(volume, pan);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + duration);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  noiseBurst(duration, filterFreq, volume, type = 'lowpass', pan = 0, q = 0.7, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.now() + delay;
    const src = this.noiseSource(duration + 0.05);
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(filterFreq, t);
    filter.Q.value = q;
    const gain = this.gainNode(0.0001, pan);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(filter);
    filter.connect(gain);
    src.start(t, Math.random() * 2);
    src.stop(t + duration + 0.05);
  }

  startAmbient() {
    if (!this.ctx || this.ambientStarted) return;
    this.ambientStarted = true;
    const t = this.now();
    const len = Math.floor(this.ctx.sampleRate * 4);
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + (Math.random() * 2 - 1) * 0.03) * 0.998;
      data[i] = last;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.32;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t);

    const drone = this.ctx.createOscillator();
    const droneGain = this.ctx.createGain();
    drone.type = 'sine';
    drone.frequency.value = 43;
    droneGain.gain.value = 0.018;
    drone.connect(droneGain);
    droneGain.connect(this.master);
    drone.start(t);

    const drone2 = this.ctx.createOscillator();
    const drone2Gain = this.ctx.createGain();
    drone2.type = 'triangle';
    drone2.frequency.value = 64.5;
    drone2Gain.gain.value = 0.006;
    drone2.connect(drone2Gain);
    drone2Gain.connect(this.master);
    drone2.start(t);
  }

  rifleShot(pan = 0) {
    if (!this.ctx || this.muted) return;
    this.noiseBurst(0.09, 4200, 0.46, 'lowpass', pan, 0.6);
    this.noiseBurst(0.18, 580, 0.32, 'lowpass', pan, 0.9);
    this.tone(135, 0.15, 'triangle', 0.32, 42, pan);
    this.tone(2800, 0.035, 'square', 0.018, 1300, pan);
  }

  pistolShot(pan = 0) {
    if (!this.ctx || this.muted) return;
    this.noiseBurst(0.07, 5200, 0.34, 'highpass', pan, 0.7);
    this.noiseBurst(0.12, 700, 0.22, 'lowpass', pan, 0.9);
    this.tone(190, 0.1, 'triangle', 0.2, 65, pan);
  }

  enemyShot(pan = 0, distance = 20) {
    if (!this.ctx || this.muted) return;
    const vol = Math.max(0.03, 0.18 * (1 - Math.min(1, distance / 80)));
    this.noiseBurst(0.07, 3000, vol, 'bandpass', pan, 1.2);
    this.tone(150, 0.09, 'triangle', vol * 0.9, 60, pan);
  }

  dryFire() {
    this.noiseBurst(0.025, 2500, 0.08, 'highpass', 0, 1);
    this.tone(1100, 0.02, 'square', 0.025);
  }

  hit(headshot = false) {
    if (headshot) {
      this.tone(1650, 0.09, 'sine', 0.085, 2100);
      this.tone(2300, 0.05, 'square', 0.018, 2700);
    } else {
      this.tone(780, 0.04, 'square', 0.028, 560);
    }
  }

  kill() {
    this.tone(520, 0.07, 'triangle', 0.06, 390);
    this.tone(1040, 0.12, 'sine', 0.03, 1320, 0, 0.04);
  }

  reloadStart() {
    this.noiseBurst(0.035, 1800, 0.1, 'bandpass', 0, 1.4);
    this.noiseBurst(0.04, 1200, 0.08, 'bandpass', 0, 1.2, 0.16);
  }

  reloadEnd() {
    this.noiseBurst(0.03, 2400, 0.11, 'bandpass', 0, 1.6);
    this.noiseBurst(0.045, 1500, 0.08, 'bandpass', 0, 1.2, 0.07);
    this.tone(420, 0.045, 'square', 0.018);
  }

  switchWeapon() {
    this.noiseBurst(0.05, 1600, 0.07, 'bandpass', 0, 1);
    this.tone(330, 0.05, 'square', 0.012);
  }

  footstep(sprint = false) {
    this.noiseBurst(sprint ? 0.06 : 0.045, sprint ? 450 : 300, 0.055, 'lowpass', 0, 1.2);
  }

  hurt() {
    this.noiseBurst(0.18, 320, 0.2, 'lowpass', 0, 0.8);
    this.tone(68, 0.22, 'sine', 0.15, 42);
    this.tone(1800, 0.09, 'sine', 0.02, 1100);
  }

  whiz(pan = 0) {
    this.noiseBurst(0.075, 2600, 0.045, 'bandpass', pan, 4.5);
  }

  explosion(pan = 0) {
    if (!this.ctx || this.muted) return;
    this.noiseBurst(0.55, 1200, 0.5, 'lowpass', pan, 0.8);
    this.noiseBurst(0.22, 5000, 0.2, 'highpass', pan, 0.5);
    this.tone(52, 0.7, 'sine', 0.5, 24, pan);
    this.tone(90, 0.28, 'triangle', 0.25, 35, pan);
  }

  grenadeBounce(pan = 0) {
    this.tone(700, 0.035, 'square', 0.015, 450, pan);
  }

  pickup() {
    this.tone(620, 0.06, 'sine', 0.05, 820);
    this.tone(980, 0.06, 'sine', 0.035, 1230, 0, 0.05);
  }

  waveHorn() {
    this.tone(88, 1.15, 'sawtooth', 0.055, 62);
    this.tone(131, 1.2, 'triangle', 0.035, 92);
    this.tone(176, 0.8, 'sawtooth', 0.018, 130, 0, 0.08);
  }

  ui() {
    this.tone(760, 0.035, 'square', 0.018, 920);
  }

  melee() {
    this.noiseBurst(0.09, 900, 0.14, 'bandpass', 0, 1.4);
    this.tone(240, 0.1, 'triangle', 0.05, 120);
  }

  playerDeath() {
    this.tone(72, 1.8, 'sine', 0.1, 28);
    this.noiseBurst(0.5, 400, 0.1, 'lowpass');
  }
}
