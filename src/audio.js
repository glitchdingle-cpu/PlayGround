// Tiny procedural sound engine. No audio files are needed.
export class AudioEngine {
  constructor() {
    this.ctx = null
    this.master = null
    this.muted = false
    this.noise = null
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume()
      return
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return
    this.ctx = new AudioContext()
    this.master = this.ctx.createGain()
    this.master.gain.value = 0.42
    this.master.connect(this.ctx.destination)
    const length = this.ctx.sampleRate * 1.2
    this.noise = this.ctx.createBuffer(1, length, this.ctx.sampleRate)
    const data = this.noise.getChannelData(0)
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
  }

  setMuted(value) {
    this.muted = value
    if (this.master) this.master.gain.setTargetAtTime(value ? 0 : 0.42, this.ctx.currentTime, 0.02)
  }

  burst({ duration = 0.12, volume = 0.25, frequency = 800, q = 0.8, type = 'lowpass', delay = 0, pitch = 1 }) {
    if (!this.ctx || this.muted) return
    const now = this.ctx.currentTime + delay
    const source = this.ctx.createBufferSource()
    source.buffer = this.noise
    source.playbackRate.value = pitch
    const filter = this.ctx.createBiquadFilter()
    filter.type = type
    filter.frequency.setValueAtTime(frequency, now)
    filter.Q.value = q
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    source.connect(filter)
    filter.connect(gain)
    gain.connect(this.master)
    source.start(now)
    source.stop(now + duration + 0.02)
  }

  tone({ frequency = 220, endFrequency = frequency, duration = 0.08, volume = 0.15, type = 'sine', delay = 0 }) {
    if (!this.ctx || this.muted) return
    const now = this.ctx.currentTime + delay
    const oscillator = this.ctx.createOscillator()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, now)
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + duration)
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.006)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    oscillator.connect(gain)
    gain.connect(this.master)
    oscillator.start(now)
    oscillator.stop(now + duration + 0.03)
  }

  step(surface = 'grass') {
    const soft = surface === 'sand' || surface === 'snow'
    this.burst({
      duration: soft ? 0.09 : 0.075,
      volume: soft ? 0.07 : 0.11,
      frequency: soft ? 520 : surface === 'stone' ? 1250 : 760,
      q: 0.6,
      pitch: 0.8 + Math.random() * 0.35,
    })
  }

  jump() {
    this.tone({ frequency: 150, endFrequency: 100, duration: 0.09, volume: 0.04, type: 'triangle' })
  }

  breakBlock(blockName = '') {
    const stony = /stone|cobble|brick|bedrock/i.test(blockName)
    this.burst({ duration: 0.18, volume: 0.22, frequency: stony ? 1700 : 820, pitch: 0.9 + Math.random() * 0.3 })
    this.tone({ frequency: stony ? 170 : 110, endFrequency: 60, duration: 0.13, volume: 0.14, type: 'triangle' })
  }

  placeBlock() {
    this.burst({ duration: 0.075, volume: 0.13, frequency: 1300, q: 0.7 })
    this.tone({ frequency: 240, endFrequency: 150, duration: 0.06, volume: 0.06, type: 'square' })
  }

  select() {
    this.tone({ frequency: 520, endFrequency: 680, duration: 0.045, volume: 0.035, type: 'triangle' })
  }

  splash() {
    this.burst({ duration: 0.35, volume: 0.16, frequency: 650, q: 0.4, type: 'bandpass', pitch: 0.7 })
  }

  hurt() {
    this.tone({ frequency: 180, endFrequency: 75, duration: 0.22, volume: 0.14, type: 'sawtooth' })
    this.burst({ duration: 0.12, volume: 0.08, frequency: 500 })
  }

  click() {
    this.tone({ frequency: 300, endFrequency: 360, duration: 0.03, volume: 0.03, type: 'square' })
  }
}
