import { Mesh, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, Vector2, Vector4, WebGLRenderer } from 'three'
import fragmentShader from './artwork.frag?raw'
import type { SoundFrame } from './audio'

export class Painting {
  private renderer: WebGLRenderer
  private scene = new Scene()
  private camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
  private geometry = new PlaneGeometry(2, 2)
  private material = new ShaderMaterial({
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
    fragmentShader,
    uniforms: { uTime: { value: 0 }, uSound: { value: new Vector4() }, uPulse: { value: 0 }, uMotion: { value: 1 }, uResolution: { value: new Vector2() }, uDuration: { value: 149.893 } },
    depthTest: false, depthWrite: false,
  })
  private canvas: HTMLCanvasElement
  private observer: ResizeObserver | null = null
  private fixedSize: { width: number; height: number } | undefined
  private onError: (message: string) => void
  private lost = false
  private quality = 2
  private slow = 0
  private previousFrame = 0
  private nativeRatio = devicePixelRatio || 1
  private filename = 'Tantra'

  constructor(canvas: HTMLCanvasElement, onError: (message: string) => void, fixedSize?: { width: number; height: number }, artwork?: { shader: string; filename: string; duration: number }) {
    this.canvas = canvas; this.onError = onError
    this.fixedSize = fixedSize
    if (artwork) { this.material.fragmentShader = artwork.shader; this.filename = artwork.filename; this.material.uniforms.uDuration.value = artwork.duration }
    this.renderer = new WebGLRenderer({ canvas, alpha: false, antialias: false, preserveDrawingBuffer: true })
    this.renderer.debug.onShaderError = () => onError('The artwork could not render. Try a browser with WebGL enabled.')
    this.scene.add(new Mesh(this.geometry, this.material))
    if (!fixedSize) { this.observer = new ResizeObserver(this.resize); this.observer.observe(canvas) }
    canvas.addEventListener('webglcontextlost', this.onLost)
    canvas.addEventListener('webglcontextrestored', this.onRestored)
    this.resize()
  }
  private onLost = (event: Event) => { event.preventDefault(); this.lost = true; this.onError('Graphics paused. Restoring the artwork...') }
  private onRestored = () => { this.lost = false; this.resize(); this.onError('') }
  setDuration(duration: number) { this.material.uniforms.uDuration.value = duration }
  resize = () => {
    if (this.lost) return
    const bounds = this.fixedSize ?? this.canvas.getBoundingClientRect()
    if (!bounds.width || !bounds.height) return
    const context = this.renderer.getContext()
    const maximum = Math.min(context.getParameter(context.MAX_TEXTURE_SIZE), context.getParameter(context.MAX_RENDERBUFFER_SIZE))
    if (this.fixedSize && Math.max(bounds.width, bounds.height) > maximum) throw new Error('This graphics device cannot export at the requested resolution.')
    const ratio = this.fixedSize ? 1 : Math.min(devicePixelRatio || 1, this.quality, maximum / bounds.width, maximum / bounds.height)
    this.renderer.setPixelRatio(ratio); this.renderer.setSize(bounds.width, bounds.height, false)
    this.material.uniforms.uResolution.value.set(this.canvas.width, this.canvas.height)
    this.canvas.dataset.scale = String(ratio)
    this.canvas.dispatchEvent(new CustomEvent('quality', { detail: ratio }))
    this.render()
  }
  draw(time: number, sound: SoundFrame, motion: boolean, playing = false) {
    const now = performance.now()
    const elapsed = now - this.previousFrame
    if (!this.fixedSize && this.nativeRatio !== (devicePixelRatio || 1)) { this.nativeRatio = devicePixelRatio || 1; this.quality = 2; this.slow = 0; this.resize() }
    if (playing && this.previousFrame && elapsed > 52 && elapsed < 1000) this.slow++
    else this.slow = Math.max(0, this.slow - 1)
    this.previousFrame = playing ? now : 0
    if (!this.fixedSize && this.slow >= 8 && this.renderer.getPixelRatio() > .5) {
      const current = this.renderer.getPixelRatio()
      this.quality = current > 1 ? Math.max(1, current - .5) : current > .75 ? .75 : .5
      this.slow = 0; this.resize()
    }
    this.material.uniforms.uTime.value = time
    this.material.uniforms.uSound.value.set(sound.bass, sound.middle, sound.treble, sound.energy)
    this.material.uniforms.uPulse.value = sound.pulse
    this.material.uniforms.uMotion.value = motion ? 1 : 0
    this.canvas.dataset.time = time.toFixed(3)
    this.canvas.dataset.energy = sound.energy.toFixed(4)
    this.canvas.dataset.motion = motion ? 'reactive' : 'still'
    this.render()
  }
  private render() { if (!this.lost) { this.renderer.render(this.scene, this.camera); this.canvas.dataset.ready = 'true' } }
  async download() {
    if (this.lost) return
    const previousRatio = this.renderer.getPixelRatio()
    const bounds = this.canvas.getBoundingClientRect()
    try {
      this.renderer.setPixelRatio(1); this.renderer.setSize(1920, 1080, false); this.render()
      const blob = await new Promise<Blob | null>(resolve => this.canvas.toBlob(resolve, 'image/png'))
      if (!blob) throw new Error('Could not save the artwork.')
      const url = URL.createObjectURL(blob), link = document.createElement('a')
      link.href = url; link.download = `${this.filename}.png`; link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } finally { this.renderer.setPixelRatio(previousRatio); this.renderer.setSize(bounds.width, bounds.height, false); this.render() }
  }
  dispose() {
    this.observer?.disconnect(); this.canvas.removeEventListener('webglcontextlost', this.onLost); this.canvas.removeEventListener('webglcontextrestored', this.onRestored)
    this.geometry.dispose(); this.material.dispose(); this.renderer.dispose()
  }
}