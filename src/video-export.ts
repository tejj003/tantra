import { AudioBufferSource, BufferTarget, CanvasSource, Mp4OutputFormat, Output, Quality, WebMOutputFormat, canEncodeAudio, canEncodeVideo } from 'mediabunny'
import { Painting } from './scene'
import { silence, type Soundtrack } from './audio'
import { drawOpening, openingSeconds } from './opening'

export async function exportVideo(soundtrack: Pick<Soundtrack, 'duration' | 'decodedAudio' | 'sample'>, options: {
  signal: AbortSignal
  onProgress: (fraction: number) => void
  motion: boolean
  artwork?: { shader: string; filename: string; title: string; statement: string }
}) {
  const width = 1920, height = 1080, frameRate = 30
  const audio = soundtrack.decodedAudio
  const videoQuality = new Quality({ bitrate: 4_000_000 })
  const audioQuality = new Quality({ bitrate: 192_000 })
  const mp4 = await canEncodeVideo('avc', { width, height, frameRate, quality: videoQuality }) && await canEncodeAudio('aac', { numberOfChannels: audio.numberOfChannels, sampleRate: audio.sampleRate, quality: audioQuality })
  if (!mp4 && !(await canEncodeVideo('vp8', { width, height, frameRate, quality: videoQuality }) && await canEncodeAudio('opus', { numberOfChannels: audio.numberOfChannels, sampleRate: audio.sampleRate, quality: audioQuality }))) {
    throw new Error('Video export is unavailable in this browser. Try current Chrome or Edge with hardware acceleration.')
  }
  options.signal.throwIfAborted()
  await document.fonts.ready
  const composed = document.createElement('canvas'); composed.width = width; composed.height = height
  const context = composed.getContext('2d')!
  drawOpening(composed, options.artwork?.statement)
  const canvas = document.createElement('canvas')
  const target = new BufferTarget()
  const output = new Output({ format: mp4 ? new Mp4OutputFormat({ fastStart: 'in-memory' }) : new WebMOutputFormat(), target })
  const video = new CanvasSource(composed, { codec: mp4 ? 'avc' : 'vp8', quality: videoQuality, keyFrameInterval: 2 })
  const music = new AudioBufferSource({ codec: mp4 ? 'aac' : 'opus', quality: audioQuality })
  output.addVideoTrack(video, { frameRate }); output.addAudioTrack(music)
  output.setMetadataTags({ title: options.artwork?.title ?? 'Tantra', artist: 'Tejj' })
  let painting: Painting | undefined
  let graphicsError = ''
  const total = openingSeconds + soundtrack.duration
  const frameCount = Math.ceil(total * frameRate)
  try {
    painting = new Painting(canvas, message => { graphicsError = message }, { width, height }, options.artwork ? { ...options.artwork, duration: soundtrack.duration } : undefined)
    await output.start()
    const openingSamples = Math.round(openingSeconds * audio.sampleRate)
    const totalSamples = openingSamples + audio.length
    for (let frame = 0; frame < frameCount; frame++) {
      options.signal.throwIfAborted()
      if (graphicsError) throw new Error(graphicsError)
      const timestamp = frame / frameRate
      if (frame % frameRate === 0) {
        const start = Math.round(timestamp * audio.sampleRate)
        const length = Math.min(audio.sampleRate, totalSamples - start)
        if (length > 0) {
          const chunk = new AudioBuffer({ numberOfChannels: audio.numberOfChannels, length, sampleRate: audio.sampleRate })
          if (start >= openingSamples) for (let channel = 0; channel < audio.numberOfChannels; channel++) {
            chunk.copyToChannel(audio.getChannelData(channel).subarray(start - openingSamples, start - openingSamples + length), channel)
          }
          await music.add(chunk)
        }
      }
      if (timestamp >= openingSeconds) {
        const time = timestamp - openingSeconds
        painting.draw(options.motion ? time : 0, options.motion ? soundtrack.sample(time) : silence(), options.motion)
        if (graphicsError) throw new Error(graphicsError)
        context.drawImage(canvas, 0, 0)
      }
      await video.add(timestamp, Math.min(1 / frameRate, total - timestamp))
      if (frame % 5 === 0) {
        options.onProgress(frame / frameCount * .98)
        await new Promise<void>(resolve => setTimeout(resolve, 0))
      }
    }
    music.close(); video.close(); options.signal.throwIfAborted()
    options.onProgress(.99)
    await output.finalize()
    options.signal.throwIfAborted()
    if (!target.buffer) throw new Error('The video could not be finalized.')
    options.onProgress(1)
    return { blob: new Blob([target.buffer], { type: mp4 ? 'video/mp4' : 'video/webm' }), filename: `${options.artwork?.filename ?? 'Tantra'}.${mp4 ? 'mp4' : 'webm'}` }
  } catch (error) {
    if (output.state !== 'finalized' && output.state !== 'canceled') await output.cancel()
    throw error
  } finally { painting?.dispose() }
}