export type SoundFrame = { bass: number; middle: number; treble: number; energy: number; pulse: number }
export const silence = (): SoundFrame => ({ bass: 0, middle: 0, treble: 0, energy: 0, pulse: 0 })

export class Soundtrack extends EventTarget {
  duration = 0
  ready = false
  playing = false
  private buffer: AudioBuffer | null = null
  private frames: SoundFrame[] = []
  private context: AudioContext | null = null
  private gain: GainNode | null = null
  private source: AudioBufferSourceNode | null = null
  private offset = 0
  private started = 0
  private volume = .75
  private intent = 0

  async load(url: string, fallbackUrl?: string) {
    const decoder = new OfflineAudioContext(2, 1, 48000)
    const decode = async (source: string) => {
      const response = await fetch(source)
      if (!response.ok) throw new Error(`Audio could not load (${response.status}).`)
      return decoder.decodeAudioData(await response.arrayBuffer())
    }
    try { this.buffer = await decode(url) }
    catch (error) {
      if (!fallbackUrl) throw error
      this.buffer = await decode(fallbackUrl)
    }
    this.duration = this.buffer.duration
    const analysis = new OfflineAudioContext(4, Math.ceil(this.duration * 22050), 22050)
    const source = analysis.createBufferSource()
    source.buffer = this.buffer
    const merger = analysis.createChannelMerger(4)
    for (const [index, type, frequency] of [[0, 'lowpass', 180], [1, 'bandpass', 900], [2, 'highpass', 2800], [3, 'allpass', 1000]] as const) {
      const filter = analysis.createBiquadFilter()
      filter.type = type; filter.frequency.value = frequency; filter.Q.value = .65
      filter.channelCount = 1; filter.channelCountMode = 'explicit'
      source.connect(filter); filter.connect(merger, 0, index)
    }
    merger.connect(analysis.destination); source.start()
    const filtered = await analysis.startRendering()
    const channels = Array.from({ length: 4 }, (_, index) => filtered.getChannelData(index))
    const step = filtered.sampleRate / 50
    const raw: number[][] = []
    for (let frame = 0; frame < this.duration * 50; frame++) {
      const start = Math.floor(frame * step), end = Math.min(filtered.length, Math.floor((frame + 1) * step))
      raw.push(channels.map(channel => {
        let power = 0
        for (let index = start; index < end; index++) power += channel[index] * channel[index]
        return Math.sqrt(power / Math.max(1, end - start))
      }))
    }
    const reference = channels.map((_, index) => {
      const values = raw.map(frame => frame[index]).sort((first, second) => first - second)
      return Math.max(.005, values[Math.floor(values.length * .95)])
    })
    const smoothed = [0, 0, 0, 0]
    let previousBass = 0, pulse = 0
    this.frames = raw.map(frame => {
      const target = frame.map((value, index) => Math.min(1.25, Math.pow(value / reference[index], .8)))
      for (let index = 0; index < 4; index++) {
        const rate = target[index] > smoothed[index] ? .27 : .09
        smoothed[index] += (target[index] - smoothed[index]) * rate
      }
      pulse = Math.max(pulse * .83, Math.min(1, Math.max(0, target[0] - previousBass) * 2.6))
      previousBass = target[0]
      return { bass: smoothed[0], middle: smoothed[1], treble: smoothed[2], energy: smoothed[3], pulse }
    })
    this.ready = true
    this.dispatchEvent(new Event('ready'))
  }
  get time() {
    return this.playing && this.context ? Math.min(this.duration, this.offset + this.context.currentTime - this.started) : this.offset
  }
  sample(time = this.time): SoundFrame {
    if (!this.frames.length) return silence()
    const position = Math.max(0, Math.min(this.frames.length - 1, time * 50))
    const first = this.frames[Math.floor(position)], second = this.frames[Math.min(this.frames.length - 1, Math.ceil(position))]
    const fraction = position % 1
    return Object.fromEntries(Object.keys(first).map(key => [key, first[key as keyof SoundFrame] + (second[key as keyof SoundFrame] - first[key as keyof SoundFrame]) * fraction])) as SoundFrame
  }
  async unlock() {
    if (!this.context) {
      this.context = new AudioContext()
      this.gain = this.context.createGain(); this.gain.gain.value = this.volume; this.gain.connect(this.context.destination)
    }
    await this.context.resume()
  }
  get decodedAudio() {
    if (!this.buffer || !this.ready) throw new Error('The soundtrack is not ready.')
    return this.buffer
  }
  async play() {
    if (!this.ready || !this.buffer || this.playing) return
    const intent = ++this.intent
    await this.unlock()
    if (intent !== this.intent || !this.context) return
    if (this.offset >= this.duration - .03) this.offset = 0
    const source = this.context.createBufferSource(); source.buffer = this.buffer
    source.connect(this.gain!)
    this.source = source; this.started = this.context.currentTime; this.playing = true
    source.onended = () => {
      if (this.source !== source) return
      this.source = null; this.playing = false; this.offset = this.duration
      source.disconnect(); this.dispatchEvent(new Event('change'))
    }
    source.start(0, this.offset)
    this.dispatchEvent(new Event('change'))
  }
  pause() {
    this.intent++
    this.offset = this.time; this.playing = false
    if (this.source) { this.source.onended = null; this.source.stop(); this.source.disconnect(); this.source = null }
    this.dispatchEvent(new Event('change'))
  }
  async seek(time: number) {
    const resume = this.playing
    this.pause(); this.offset = Math.max(0, Math.min(this.duration, time))
    this.dispatchEvent(new Event('change'))
    if (resume) await this.play()
  }
  setVolume(value: number) {
    this.volume = Math.max(0, Math.min(1, value))
    if (this.gain && this.context) this.gain.gain.setTargetAtTime(this.volume, this.context.currentTime, .02)
  }
  dispose() { this.pause(); void this.context?.close() }
}