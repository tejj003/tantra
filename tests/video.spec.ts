import { test, expect } from '@playwright/test'
import { Input, ALL_FORMATS, BufferSource } from 'mediabunny'
import { readFile } from 'node:fs/promises'

function testTone(seconds: number) {
  const rate = 48000, samples = Math.round(rate * seconds), channels = 2
  const buffer = Buffer.alloc(44 + samples * channels * 2)
  buffer.write('RIFF', 0); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write('WAVEfmt ', 8)
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(channels, 22)
  buffer.writeUInt32LE(rate, 24); buffer.writeUInt32LE(rate * channels * 2, 28)
  buffer.writeUInt16LE(channels * 2, 32); buffer.writeUInt16LE(16, 34); buffer.write('data', 36); buffer.writeUInt32LE(buffer.length - 44, 40)
  for (let sample = 0; sample < samples; sample++) for (let channel = 0; channel < channels; channel++) {
    buffer.writeInt16LE(Math.round(Math.sin(sample / rate * Math.PI * 880) * 7000), 44 + (sample * channels + channel) * 2)
  }
  return buffer
}

for (const part of ['1', '2', '3']) {
test(`Part ${part} downloaded video contains a six-second silent statement followed by artwork and audio`, async ({ page }, testInfo) => {
  test.setTimeout(180000)
  const asset = part === '1' ? 'Tanta.mp3' : part === '2' ? 'Anc%20Egyptian%20Trance.mp3' : 'Benju.m4a'
  await page.route(`**/audio/${asset}`, route => route.fulfill({ body: testTone(.8), contentType: 'audio/wav' }))
  await page.goto(`/?part=${part}`)
  await expect(page.locator('#app')).toHaveAttribute('data-audio-ready', 'true')
  await page.evaluate(() => document.fonts.ready)
  const originalBounds = await page.locator('#painting').boundingBox()
  const pending = page.waitForEvent('download', { timeout: 120000 })
  await page.getByRole('button', { name: 'Download video', exact: true }).click()
  const download = await pending
  await expect(page.locator('#export-label')).toHaveText('Video ready')
  expect(download.suggestedFilename()).toMatch(new RegExp(`^${part === '1' ? 'Tantra' : `Tantra-Part-${part}`}\\.(mp4|webm)$`))
  const path = testInfo.outputPath(download.suggestedFilename())
  await download.saveAs(path)
  const buffer = await readFile(path)
  const input = new Input({ source: new BufferSource(buffer), formats: ALL_FORMATS })
  try {
    const video = await input.getPrimaryVideoTrack(), audio = await input.getPrimaryAudioTrack()
    expect(video).not.toBeNull(); expect(audio).not.toBeNull()
    expect(video!.displayWidth).toBe(1920); expect(video!.displayHeight).toBe(1080)
    expect(await video!.computeDuration()).toBeCloseTo(6.8, 3)
    const duration = await input.computeDuration()
    expect(duration).toBeGreaterThanOrEqual(6.8)
    expect(duration).toBeLessThan(6.9)
  } finally { input.dispose() }
  const audioLevels = await page.evaluate(async encoded => {
    const raw = Uint8Array.from(atob(encoded), value => value.charCodeAt(0))
    const decoder = new OfflineAudioContext(2, 1, 48000)
    const audio = await decoder.decodeAudioData(raw.buffer)
    const channel = audio.getChannelData(0)
    const rms = (from: number, to: number) => {
      let total = 0
      const first = Math.floor(from * audio.sampleRate), last = Math.floor(to * audio.sampleRate)
      for (let sample = first; sample < last; sample++) total += channel[sample] ** 2
      return Math.sqrt(total / (last - first))
    }
    return { intro: rms(.1, 5.9), music: rms(6.1, 6.6) }
  }, buffer.toString('base64'))
  expect(audioLevels.intro).toBeLessThan(.0001)
  expect(audioLevels.music).toBeGreaterThan(.1)
  const frames = await page.evaluate(async () => {
    const video = document.createElement('video'); video.muted = true; video.preload = 'auto'; video.playsInline = true
    document.body.append(video)
    video.src = document.querySelector<HTMLAnchorElement>('#video-result')!.href
    await new Promise<void>((resolve, reject) => { video.onloadeddata = () => resolve(); video.onerror = () => reject(new Error('Exported video could not play')) })
    const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 180
    const context = canvas.getContext('2d')!
    const frames = []
    for (const time of [.05, 5.8, 6.1, 6.6]) {
      await new Promise<void>(resolve => { video.onseeked = () => resolve(); video.currentTime = time })
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      context.drawImage(video, 0, 0, 320, 180)
      const pixels = context.getImageData(0, 0, 320, 180).data
      let white = 0, dark = 0, colour = 0
      for (let offset = 0; offset < pixels.length; offset += 4) {
        const minimum = Math.min(pixels[offset], pixels[offset + 1], pixels[offset + 2])
        const maximum = Math.max(pixels[offset], pixels[offset + 1], pixels[offset + 2])
        if (minimum > 235) white++
        if (maximum < 100) dark++
        if (maximum - minimum > 35) colour++
      }
      frames.push({ time, white: white / (320 * 180), dark: dark / (320 * 180), colour: colour / (320 * 180) })
    }
    video.removeAttribute('src'); video.load(); video.remove()
    return frames
  })
  for (const frame of frames.slice(0, 2)) { expect(frame.white).toBeGreaterThan(.9); expect(frame.dark).toBeGreaterThan(.003); expect(frame.colour).toBeLessThan(.005) }
  for (const frame of frames.slice(2)) expect(frame.colour).toBeGreaterThan(.2)
  expect(await page.locator('#painting').boundingBox()).toEqual(originalBounds)
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled()
})
}

test('video export can be cancelled without downloading a partial file', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#app')).toHaveAttribute('data-audio-ready', 'true')
  let downloads = 0; page.on('download', () => downloads++)
  await page.getByRole('button', { name: 'Download video', exact: true }).click()
  await page.getByRole('button', { name: 'Cancel video export' }).click()
  await expect(page.locator('#export-label')).toHaveText('Export cancelled', { timeout: 20000 })
  await expect(page.locator('#video-result')).toBeHidden()
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled()
  expect(downloads).toBe(0)
})