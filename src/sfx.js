// Tiny synthesized sound engine — no external audio assets.
export class Sfx {
  constructor() {
    this.ctx = null
    this.master = null
    this.enabled = true
    this.lastShot = 0
    this.lastExplosion = 0
    this.shotBudget = []
  }

  init() {
    if (this.ctx) return
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    this.ctx = new AC()
    this.master = this.ctx.createGain()
    this.master.gain.value = 0.32
    this.master.connect(this.ctx.destination)
    const len = Math.floor(this.ctx.sampleRate * 1.2)
    this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
    const data = this.noiseBuffer.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  }

  setEnabled(v) {
    this.enabled = v
    if (this.master) this.master.gain.value = v ? 0.32 : 0
  }

  tone(freq, duration, type = 'sine', gain = 0.15, slide = 0) {
    if (!this.ctx || !this.enabled) return
    const t = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + duration)
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration)
    osc.connect(g).connect(this.master)
    osc.start(t)
    osc.stop(t + duration)
  }

  noise(duration = 0.12, gain = 0.12, lowpass = 1200, highpass = 80) {
    if (!this.ctx || !this.enabled) return
    const t = this.ctx.currentTime
    const src = this.ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    src.playbackRate.value = 1
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = lowpass
    const hp = this.ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = highpass
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration)
    src.connect(filter).connect(hp).connect(g).connect(this.master)
    src.start(t)
    src.stop(t + Math.min(duration, 1.1))
  }

  click() { this.tone(520, 0.035, 'square', 0.03, 120) }
  select() { this.tone(330, 0.06, 'triangle', 0.05, 80); this.tone(495, 0.05, 'sine', 0.03, 30) }
  order() { this.tone(280, 0.07, 'sine', 0.045, 100); this.tone(420, 0.09, 'sine', 0.03, 60) }
  deny() { this.tone(150, 0.16, 'sawtooth', 0.05, -40) }
  build() { this.tone(220, 0.1, 'square', 0.03, 120); setTimeout(() => this.tone(330, 0.12, 'square', 0.025, 140), 70) }
  ready() { this.tone(440, 0.1, 'triangle', 0.04); setTimeout(() => this.tone(660, 0.16, 'triangle', 0.04), 80) }

  shoot(kind = 'bullet') {
    if (!this.ctx || !this.enabled) return
    const now = performance.now()
    this.shotBudget = this.shotBudget.filter(t => now - t < 120)
    if (this.shotBudget.length > 7) return
    this.shotBudget.push(now)
    if (kind === 'bullet') this.noise(0.07, 0.07, 2600, 500)
    else if (kind === 'shell') { this.tone(90, 0.18, 'sawtooth', 0.12, -40); this.noise(0.25, 0.14, 700, 60) }
    else this.noise(0.5, 0.08, 500, 40)
  }

  explode(big = false) {
    if (!this.ctx || !this.enabled) return
    const now = performance.now()
    if (now - this.lastExplosion < 45) return
    this.lastExplosion = now
    this.noise(big ? 0.8 : 0.4, big ? 0.3 : 0.16, big ? 420 : 900, 30)
    this.tone(big ? 55 : 80, big ? 0.7 : 0.35, 'sine', big ? 0.22 : 0.1, -30)
  }

  artillery() {
    this.tone(70, 1.4, 'sawtooth', 0.12, -40)
    this.noise(1.1, 0.16, 500, 30)
  }

  victory() {
    const notes = [392, 523, 659, 784]
    notes.forEach((n, i) => setTimeout(() => this.tone(n, 0.6, 'triangle', 0.06), i * 160))
  }

  defeat() {
    const notes = [330, 294, 247, 196]
    notes.forEach((n, i) => setTimeout(() => this.tone(n, 0.8, 'sine', 0.05), i * 230))
  }
}

export const sfx = new Sfx()
