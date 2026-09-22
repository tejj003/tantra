import '@fontsource/dm-sans/latin-400.css'
import '@fontsource/dm-sans/latin-500.css'
import '@fontsource/cormorant-garamond/latin-500.css'
import { createIcons, Play, Pause, RotateCcw, Maximize, Download, Volume2, VolumeX, Info, X, ImageDown, Square } from 'lucide'
import { Soundtrack, silence } from './audio'
import { Painting } from './scene'
import { drawOpening, OpeningClock, statementQuestion, statementCredit } from './opening'
import { currentPart, parts } from './parts'
import './gallery.css'

const statementBody = currentPart.statement
document.body.classList.toggle('part-two', currentPart.id === '2')
document.title = `${currentPart.title} / Art by Tejj`
document.querySelector('meta[name="description"]')?.setAttribute('content', `${currentPart.title}. An audio-reactive Neo-Tantric study. Art and music by Tejj.`)
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <header class="masthead"><div class="identity"><span class="edition">SOUND / FORM</span><div class="title-block">
    <h1><button id="about-art" class="title-button" aria-label="${currentPart.title} artist statement" aria-expanded="false" aria-controls="art-statement">${currentPart.title}</button></h1>
    <button id="about-ai" class="ai-button" aria-label="About the art and music" title="About the art and music" aria-expanded="false" aria-controls="ai-statement"><i data-lucide="info"></i></button>
    <section id="art-statement" class="about-panel" aria-labelledby="art-statement-heading" hidden>
      <div class="about-heading"><h2 id="art-statement-heading">Artist's statement</h2><button class="about-close" aria-label="Close artist statement" title="Close"><i data-lucide="x"></i></button></div>
      <p>${statementQuestion}</p>
      <p>${statementBody}</p>
      <span class="about-credit">Art &amp; music by Tejj</span>
    </section>
    <section id="ai-statement" class="about-panel" aria-labelledby="ai-statement-heading" hidden>
      <div class="about-heading"><h2 id="ai-statement-heading">Artist's statement</h2><button class="about-close" aria-label="Close art and music statement" title="Close"><i data-lucide="x"></i></button></div>
      <p>${statementQuestion}</p>
      <p>${statementBody}</p>
    </section>
  </div></div><span class="credit">Art &amp; music by Tejj</span></header>
  <main><section class="stage" aria-label="Framed music artwork"><div id="presentation" data-phase="artwork"><canvas id="painting" role="img" aria-label="${currentPart.title}. A Neo-Tantric composition responding to ${currentPart.track}, surrounded by a white art mat."></canvas><canvas id="opening" width="1920" height="1080" role="img" aria-label="${statementQuestion} ${statementBody} ${statementCredit}" hidden></canvas></div></section></main>
  <footer class="transport">
    <div class="track"><span class="track-name">${currentPart.track}</span><span id="play-state" role="status">Preparing audio</span></div>
    <div class="play-controls"><button id="restart" title="Restart" aria-label="Restart" disabled><i data-lucide="rotate-ccw"></i></button><button id="play" class="primary" title="Play" aria-label="Play" disabled><i data-lucide="play"></i></button></div>
    <div class="timeline"><output id="elapsed" for="seek">0:00</output><input id="seek" type="range" min="0" max="150" step="0.01" value="0" aria-label="Playback position" disabled><span id="duration">2:30</span></div>
    <div class="tools"><button id="mute" title="Mute" aria-label="Mute" aria-pressed="false"><i data-lucide="volume-2"></i></button><input id="volume" type="range" min="0" max="1" step="0.01" value="0.75" aria-label="Volume"><span class="divider"></span><button id="save" title="Save frame" aria-label="Save frame"><i data-lucide="image-down"></i></button><button id="video" title="Download video" aria-label="Download video" disabled><i data-lucide="download"></i></button><button id="fullscreen" title="Fullscreen" aria-label="Fullscreen" disabled><i data-lucide="maximize"></i></button></div>
  </footer>
  <div class="bottom-line"><nav class="part-selector" aria-label="Tantra series">${parts.map((part, index) => `<a href="?part=${part.id}" ${part.id === currentPart.id ? 'aria-current="page"' : ''}>Part ${['I', 'II', 'III'][index]}</a>`).join('')}</nav><label class="motion"><input id="motion" type="checkbox" checked>Motion</label><span id="quality">16:9</span></div>
  <p id="notice" role="alert" hidden></p>
  <div id="export-status" hidden><span id="export-label" role="status">Preparing video</span><progress id="export-progress" max="1" value="0" aria-label="Video export progress"></progress><button id="cancel-export" aria-label="Cancel video export" title="Cancel video export"><i data-lucide="square"></i></button><a id="video-result" hidden>Download video</a></div>
`
const icons = () => createIcons({ icons: { Play, Pause, RotateCcw, Maximize, Download, Volume2, VolumeX, Info, X, ImageDown, Square }, attrs: { width: 18, height: 18, 'stroke-width': 1.5, 'aria-hidden': 'true' } })
icons()
const titleBlock = document.querySelector<HTMLElement>('.title-block')!
const disclosures = [...titleBlock.querySelectorAll<HTMLButtonElement>('button[aria-controls]')]
let activeDisclosure: HTMLButtonElement | null = null
let dismissedFocus: HTMLButtonElement | null = null
let closeTimer = 0
function closeAbout(returnFocus = false) {
  clearTimeout(closeTimer)
  const trigger = activeDisclosure
  activeDisclosure = null
  disclosures.forEach(button => { button.setAttribute('aria-expanded', 'false'); document.getElementById(button.getAttribute('aria-controls')!)!.hidden = true })
  if (trigger && returnFocus) { dismissedFocus = trigger; trigger.focus({ preventScroll: true }) }
}
function openAbout(button: HTMLButtonElement) {
  closeAbout()
  activeDisclosure = button
  button.setAttribute('aria-expanded', 'true')
  document.getElementById(button.getAttribute('aria-controls')!)!.hidden = false
}
function scheduleAboutClose() {
  clearTimeout(closeTimer)
  closeTimer = window.setTimeout(() => {
    if (!titleBlock.matches(':hover') && !titleBlock.contains(document.activeElement)) closeAbout()
  }, 180)
}
disclosures.forEach(button => {
  button.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') { dismissedFocus = null; openAbout(button) } })
  button.addEventListener('focus', () => { if (dismissedFocus !== button) openAbout(button) })
  button.addEventListener('blur', () => { if (dismissedFocus === button) dismissedFocus = null })
  button.addEventListener('click', () => { dismissedFocus = null; openAbout(button) })
})
titleBlock.addEventListener('pointerenter', () => clearTimeout(closeTimer))
titleBlock.addEventListener('pointerleave', scheduleAboutClose)
titleBlock.addEventListener('focusout', scheduleAboutClose)
titleBlock.querySelectorAll('.about-close').forEach(button => button.addEventListener('click', () => closeAbout(true)))
const onOutside = (event: PointerEvent) => { if (!titleBlock.contains(event.target as Node)) closeAbout() }
document.addEventListener('pointerdown', onOutside)
const canvas = document.querySelector<HTMLCanvasElement>('#painting')!
const presentation = document.querySelector<HTMLElement>('#presentation')!
const isPresenting = () => document.fullscreenElement === presentation
const openingCanvas = document.querySelector<HTMLCanvasElement>('#opening')!
const openingClock = new OpeningClock()
let openingRequest = 0, openingPending = false
let exporting: AbortController | null = null
let videoUrl = ''
const playButton = document.querySelector<HTMLButtonElement>('#play')!
const seek = document.querySelector<HTMLInputElement>('#seek')!
const volume = document.querySelector<HTMLInputElement>('#volume')!
const motion = document.querySelector<HTMLInputElement>('#motion')!
const mute = document.querySelector<HTMLButtonElement>('#mute')!
const notice = document.querySelector<HTMLElement>('#notice')!
const status = document.querySelector<HTMLElement>('#play-state')!
const reduced = matchMedia('(prefers-reduced-motion: reduce)')
motion.checked = !reduced.matches
const soundtrack = new Soundtrack()
let painting: Painting | undefined
let animation = 0, lastRender = -1, lastTime = -1, lastMotion = !motion.checked, seekRequest = 0
const showError = (message: string) => { notice.textContent = message; notice.hidden = !message }
canvas.addEventListener('quality', event => { document.querySelector('#quality')!.textContent = `16:9 / ${Number((event as CustomEvent<number>).detail.toFixed(2))}x` })
const formatTime = (time: number) => `${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, '0')}`
try { painting = new Painting(canvas, showError, undefined, currentPart) }
catch { showError('WebGL is unavailable. Enable hardware acceleration to view the artwork.'); playButton.disabled = true }
function draw() {
  const time = soundtrack.time
  painting?.draw(motion.checked ? time : 0, motion.checked ? soundtrack.sample(time) : silence(), motion.checked, soundtrack.playing)
  seek.value = String(time)
  seek.setAttribute('aria-valuetext', `${formatTime(time)} of ${formatTime(soundtrack.duration)}`)
  document.querySelector('#elapsed')!.textContent = formatTime(time)
  canvas.dataset.playing = String(soundtrack.playing)
  lastTime = time; lastMotion = motion.checked
}
function updateControls() {
  playButton.setAttribute('aria-label', soundtrack.playing ? 'Pause' : 'Play')
  playButton.title = playButton.getAttribute('aria-label')!
  playButton.innerHTML = `<i data-lucide="${soundtrack.playing ? 'pause' : 'play'}"></i>`
  status.textContent = openingClock.active || openingPending ? 'Opening statement' : soundtrack.playing ? 'Playing' : soundtrack.time >= soundtrack.duration && soundtrack.ready ? 'Finished' : 'Paused'
  icons(); draw()
}
soundtrack.addEventListener('change', updateControls)
soundtrack.addEventListener('ready', () => {
  painting?.setDuration(soundtrack.duration)
  seek.max = String(soundtrack.duration)
  document.querySelector('#duration')!.textContent = formatTime(soundtrack.duration)
  document.querySelector<HTMLButtonElement>('#restart')!.disabled = false
  seek.disabled = false; playButton.disabled = !painting
  document.querySelector<HTMLButtonElement>('#fullscreen')!.disabled = !painting
  document.querySelector<HTMLButtonElement>('#video')!.disabled = !painting
  document.querySelector('#app')!.setAttribute('data-audio-ready', 'true')
  status.textContent = 'Ready'; draw()
})
const audioFallback = 'fallbackFile' in currentPart ? `${import.meta.env.BASE_URL}audio/${encodeURIComponent(currentPart.fallbackFile)}` : undefined
void soundtrack.load(`${import.meta.env.BASE_URL}audio/${encodeURIComponent(currentPart.file)}`, audioFallback).catch(() => { showError('The soundtrack could not load. Reload to try again.'); status.textContent = 'Audio unavailable' })
const toggle = async () => {
  if (openingClock.active || openingPending || exporting) return
  try { if (soundtrack.playing) soundtrack.pause(); else await soundtrack.play() }
  catch { showError('Audio playback could not start. Press Play to try again.'); soundtrack.pause() }
}
playButton.addEventListener('click', () => void toggle())
seek.addEventListener('input', () => {
  cancelAnimationFrame(seekRequest)
  const value = Number(seek.value)
  seekRequest = requestAnimationFrame(() => void soundtrack.seek(value).catch(() => showError('Playback could not resume. Press Play to continue.')))
})
document.querySelector('#restart')!.addEventListener('click', () => { void soundtrack.seek(0) })
let previousVolume = .75
function setVolume(value: number) {
  soundtrack.setVolume(value); volume.value = String(value)
  mute.setAttribute('aria-pressed', String(value === 0)); mute.setAttribute('aria-label', value === 0 ? 'Unmute' : 'Mute'); mute.title = mute.getAttribute('aria-label')!
  mute.innerHTML = `<i data-lucide="${value === 0 ? 'volume-x' : 'volume-2'}"></i>`; icons()
}
volume.addEventListener('input', () => setVolume(Number(volume.value)))
mute.addEventListener('click', () => { if (Number(volume.value) > 0) { previousVolume = Number(volume.value); setVolume(0) } else setVolume(previousVolume || .75) })
motion.addEventListener('change', draw)
const onReduced = () => { motion.checked = !reduced.matches; draw() }
reduced.addEventListener('change', onReduced)
function cancelOpening() {
  openingRequest++; openingPending = false; openingClock.cancel()
  openingCanvas.hidden = true; presentation.dataset.phase = 'artwork'
  delete presentation.dataset.openingStarted
}
document.querySelector('#fullscreen')!.addEventListener('click', async () => {
  if (!soundtrack.ready || !painting) return
  if (document.fullscreenElement) { await document.exitFullscreen(); return }
  cancelOpening(); closeAbout(); cancelAnimationFrame(seekRequest)
  soundtrack.pause(); void soundtrack.seek(0)
  const request = ++openingRequest
  openingPending = true; openingCanvas.hidden = false; presentation.dataset.phase = 'opening'
  drawOpening(openingCanvas, statementBody); updateControls()
  const unlocked = soundtrack.unlock()
  try {
    await Promise.all([presentation.requestFullscreen(), unlocked, document.fonts.ready])
    if (request !== openingRequest || document.hidden || !isPresenting()) return
    drawOpening(openingCanvas, statementBody); openingPending = false; openingClock.start()
    presentation.dataset.openingStarted = 'true'
  } catch {
    cancelOpening(); soundtrack.pause()
    showError('Fullscreen could not start. The artwork remains available here; press Play to listen.')
  }
})
document.querySelector<HTMLButtonElement>('#save')!.addEventListener('click', async event => {
  const button = event.currentTarget as HTMLButtonElement
  button.disabled = true
  const playing = soundtrack.playing; soundtrack.pause()
  try { await painting?.download() } catch { showError('The frame could not be saved. Try again.') }
  finally { button.disabled = false; if (playing && !document.hidden) void soundtrack.play() }
})
document.querySelector('#cancel-export')!.addEventListener('click', () => exporting?.abort())
document.querySelector('#video')!.addEventListener('click', async () => {
  if (exporting || !soundtrack.ready || !painting) return
  cancelOpening(); soundtrack.pause(); cancelAnimationFrame(seekRequest)
  const controller = new AbortController(); exporting = controller
  document.querySelectorAll('.part-selector a').forEach(link => link.setAttribute('aria-disabled', 'true'))
  const disabled = [...document.querySelectorAll<HTMLButtonElement | HTMLInputElement>('.transport button,.transport input,#motion')].map(control => ({ control, disabled: control.disabled }))
  disabled.forEach(({ control }) => { control.disabled = true })
  const panel = document.querySelector<HTMLElement>('#export-status')!
  const label = document.querySelector<HTMLElement>('#export-label')!
  const progress = document.querySelector<HTMLProgressElement>('#export-progress')!
  const cancel = document.querySelector<HTMLButtonElement>('#cancel-export')!
  const result = document.querySelector<HTMLAnchorElement>('#video-result')!
  panel.hidden = false; result.hidden = true; cancel.hidden = false; progress.hidden = false; progress.value = 0
  if (videoUrl) { URL.revokeObjectURL(videoUrl); videoUrl = ''; result.removeAttribute('href') }
  label.textContent = 'Preparing 1080p video'
  try {
    const { exportVideo } = await import('./video-export')
    const video = await exportVideo(soundtrack, { signal: controller.signal, motion: motion.checked, artwork: currentPart, onProgress: fraction => {
      progress.value = fraction; label.textContent = fraction >= .99 ? 'Finishing video' : `Rendering video ${Math.floor(fraction * 100)}%`
    } })
    controller.signal.throwIfAborted()
    videoUrl = URL.createObjectURL(video.blob); result.href = videoUrl; result.download = video.filename
    result.hidden = false; result.textContent = `Download ${video.filename}`; label.textContent = 'Video ready'; result.click()
  } catch (error) {
    label.textContent = controller.signal.aborted ? 'Export cancelled' : 'Export unavailable'
    if (!controller.signal.aborted) showError(error instanceof Error ? error.message : 'The video could not be exported.')
  } finally {
    exporting = null; disabled.forEach(({ control, disabled }) => { control.disabled = disabled })
    document.querySelectorAll('.part-selector a').forEach(link => link.removeAttribute('aria-disabled'))
    cancel.hidden = true; progress.hidden = true
  }
})
document.querySelectorAll('.part-selector a').forEach(link => link.addEventListener('click', event => { if (exporting) event.preventDefault() }))
const onKey = (event: KeyboardEvent) => {
  if (activeDisclosure && event.key === 'Escape') { event.preventDefault(); closeAbout(true); return }
  if (event.target instanceof HTMLElement && event.target.closest('.about-panel')) return
  if (event.target instanceof HTMLElement && event.target.matches('input,button,a') || event.ctrlKey || event.altKey || event.metaKey) return
  if (exporting) return
  if ((openingClock.active || openingPending) && ['Space', 'ArrowLeft', 'ArrowRight'].includes(event.code)) { event.preventDefault(); return }
  if (event.code === 'Space') { event.preventDefault(); void toggle() }
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); void soundtrack.seek(soundtrack.time + (event.key === 'ArrowLeft' ? -5 : 5)) }
  if (event.key === 'Escape' && document.fullscreenElement) void document.exitFullscreen()
}
document.addEventListener('keydown', onKey)
const onHidden = () => { if (document.hidden) { cancelOpening(); soundtrack.pause() } }
const onLeave = () => { exporting?.abort(); cancelOpening(); soundtrack.pause() }
document.addEventListener('visibilitychange', onHidden)
window.addEventListener('pagehide', onLeave)
canvas.addEventListener('webglcontextlost', onLeave)
const onResize = () => {
  if (document.fullscreenElement) closeAbout()
  if (document.fullscreenElement !== presentation && (openingClock.active || openingPending)) { cancelOpening(); soundtrack.pause() }
  painting?.resize(); draw()
}
window.addEventListener('resize', onResize)
document.addEventListener('fullscreenchange', onResize)
function tick(timestamp: number) {
  if (!document.hidden && document.fullscreenElement === presentation && openingClock.advance(timestamp)) {
    const request = openingRequest
    openingPending = true
    void soundtrack.play().then(() => {
      if (request !== openingRequest) return
      openingPending = false; openingCanvas.hidden = true; presentation.dataset.phase = 'artwork'; updateControls()
    }).catch(() => { cancelOpening(); soundtrack.pause(); showError('Audio could not start. Exit fullscreen and press Play to retry.') })
  }
  if (!document.hidden && timestamp - lastRender > 32 && (soundtrack.time !== lastTime || motion.checked !== lastMotion)) { draw(); lastRender = timestamp }
  animation = requestAnimationFrame(tick)
}
draw(); animation = requestAnimationFrame(tick)
if (import.meta.hot) import.meta.hot.dispose(() => {
  cancelAnimationFrame(animation); cancelAnimationFrame(seekRequest); soundtrack.dispose(); painting?.dispose()
  cancelOpening()
  exporting?.abort(); if (videoUrl) URL.revokeObjectURL(videoUrl)
  clearTimeout(closeTimer); document.removeEventListener('pointerdown', onOutside)
  document.removeEventListener('keydown', onKey); document.removeEventListener('visibilitychange', onHidden); window.removeEventListener('pagehide', onLeave)
  window.removeEventListener('resize', onResize); document.removeEventListener('fullscreenchange', onResize); reduced.removeEventListener('change', onReduced)
})
