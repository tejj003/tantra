import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { expectSamePixels } from './pixels'

async function ready(page: Page) {
  await page.goto('/?part=3')
  await expect(page.locator('#app')).toHaveAttribute('data-audio-ready', 'true', { timeout: 30000 })
  await expect(page.locator('#notice')).toBeHidden()
  await page.evaluate(() => document.fonts.ready)
}
async function at(page: Page, time: number) {
  await page.locator('#seek').fill(String(time))
  await expect(page.locator('#painting')).toHaveAttribute('data-time', time.toFixed(3))
}
async function sample(page: Page) {
  return page.locator('#painting').evaluate((canvas: HTMLCanvasElement) => {
    const frame = document.createElement('canvas'); frame.width = 160; frame.height = 90
    const context = frame.getContext('2d')!; context.drawImage(canvas, 0, 0, 160, 90)
    const data = [...context.getImageData(0, 0, 160, 90).data]
    let colour = 0, white = 0, border = 0
    for (let row = 0; row < 90; row++) for (let column = 0; column < 160; column++) {
      const offset = (row * 160 + column) * 4
      const values = data.slice(offset, offset + 3)
      if (Math.max(...values) - Math.min(...values) > 25) colour++
      if (row < 6 || row > 83 || column < 15 || column > 144) { border++; if (Math.min(...values) > 230) white++ }
    }
    return { data, colour: colour / 14400, border: white / border }
  })
}

test('Part 3 renders cloud compositions with Benju and preserves the white mat across viewports', async ({ page }, testInfo) => {
  test.setTimeout(120000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await ready(page)
  await expect(page).toHaveTitle('Tantra Part 3 / Art by Tejj')
  await expect(page.locator('.track-name')).toHaveText('Benju')
  expect(Number(await page.locator('#seek').getAttribute('max'))).toBeCloseTo(215.361917, 2)
  await expect(page.getByRole('link', { name: 'Part III', exact: true })).toHaveAttribute('aria-current', 'page')
  for (const [width, height] of [[1440, 1000], [390, 844], [320, 640], [844, 430]]) {
    await page.setViewportSize({ width, height })
    await expect.poll(() => page.locator('#painting').evaluate((canvas: HTMLCanvasElement) => {
      const bounds = canvas.getBoundingClientRect(), ratio = Number(canvas.dataset.scale)
      return canvas.width === Math.floor(bounds.width * ratio) && canvas.height === Math.floor(bounds.height * ratio)
    })).toBe(true)
    const states: number[][] = []
    for (const time of [0, 45, 100, 165, 205, 214]) {
      await at(page, time)
      const pixels = await sample(page)
      expect(pixels.colour).toBeGreaterThan(.15)
      expect(pixels.border).toBeGreaterThan(.99)
      states.push(pixels.data)
      if ([0, 165, 214].includes(time)) await page.screenshot({ path: testInfo.outputPath(`part3-${width}-${time}.png`) })
    }
    expect(new Set(states.map(pixels => pixels.join(','))).size).toBe(6)
    await at(page, 45)
    expectSamePixels((await sample(page)).data, states[1])
    const layout = await page.evaluate(() => {
      const canvas = document.querySelector('#painting')!.getBoundingClientRect()
      const controls = [...document.querySelectorAll<HTMLElement>('button,input,.part-selector a,h1,.credit')].filter(element => element.getBoundingClientRect().width)
      const navigation = document.querySelector('.part-selector')!.getBoundingClientRect()
      const motion = document.querySelector('.motion')!.getBoundingClientRect()
      return { ratio: canvas.width / canvas.height, overflow: document.documentElement.scrollWidth > innerWidth, collision: navigation.right > motion.left, clipped: controls.filter(element => { const bounds = element.getBoundingClientRect(); return bounds.left < 0 || bounds.right > innerWidth + 1 || bounds.bottom > innerHeight + 1 }).map(element => element.id || element.className) }
    })
    expect(layout).toMatchObject({ overflow: false, collision: false, clipped: [] })
    expect(layout.ratio).toBeCloseTo(16 / 9, 2)
  }
  expect(errors).toEqual([])
})

test('Part 3 responds to music, freezes on pause and gently returns to rest', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 600 })
  await ready(page); await at(page, 102)
  const before = await sample(page)
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect.poll(async () => Number(await page.locator('#painting').getAttribute('data-time'))).toBeGreaterThan(102.5)
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  const paused = await sample(page)
  expect(paused.data).not.toEqual(before.data)
  expect(Number(await page.locator('#painting').getAttribute('data-energy'))).toBeGreaterThan(.3)
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  expect((await sample(page)).data).toEqual(paused.data)
  await page.locator('#motion').uncheck()
  const resting = await sample(page)
  await page.locator('#motion').check()
  await at(page, 214)
  expectSamePixels((await sample(page)).data, resting.data)
  await at(page, 215)
  expectSamePixels((await sample(page)).data, resting.data)
})

test('Part 3 audio accents shape clouds and leaves while treble drives outward water ripples', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 })
  await page.addInitScript(() => {
    const controls = { bands: [.6, .6, .6, .6], pulse: 0 }
    Object.defineProperty(window, 'soundProbe', { value: controls })
    const locations = new WeakMap<WebGLUniformLocation, string>()
    const getLocation = WebGL2RenderingContext.prototype.getUniformLocation
    const vector = WebGL2RenderingContext.prototype.uniform4f
    const scalar = WebGL2RenderingContext.prototype.uniform1f
    WebGL2RenderingContext.prototype.getUniformLocation = function (program, name) {
      const location = getLocation.call(this, program, name)
      if (location) locations.set(location, name)
      return location
    }
    WebGL2RenderingContext.prototype.uniform4f = function (location, first, second, third, fourth) {
      if (location && locations.get(location) === 'uSound') return vector.call(this, location, controls.bands[0], controls.bands[1], controls.bands[2], controls.bands[3])
      return vector.call(this, location, first, second, third, fourth)
    }
    WebGL2RenderingContext.prototype.uniform1f = function (location, value) {
      return scalar.call(this, location, location && locations.get(location) === 'uPulse' ? controls.pulse : value)
    }
  })
  await ready(page)
  const frame = async (bands: number[], pulse = 0) => {
    await page.evaluate(({ bands, pulse }) => {
      const probe = (window as unknown as { soundProbe: { bands: number[]; pulse: number } }).soundProbe
      probe.bands = bands; probe.pulse = pulse
    }, { bands, pulse })
    await at(page, 101); await at(page, 102)
    return (await sample(page)).data
  }
  const baseline = await frame([.6, .6, .6, .6])
  const accent = await frame([.6, .6, .6, .6], .65)
  const bass = await frame([1.1, .6, .6, .6])
  const middle = await frame([.6, 1.1, .6, .6])
  const treble = await frame([.6, .6, 1.1, .6])
  const difference = (pixels: number[], left: number, right: number, top: number, bottom: number) => {
    let total = 0, count = 0
    for (let row = top; row < bottom; row++) for (let column = left; column < right; column++) {
      const offset = (row * 160 + column) * 4
      for (let channel = 0; channel < 3; channel++) { total += Math.abs(pixels[offset + channel] - baseline[offset + channel]); count++ }
    }
    return total / count
  }
  expect(difference(accent, 24, 62, 16, 42), 'Accents lift the clouds').toBeGreaterThan(.4)
  expect(difference(accent, 66, 94, 42, 66), 'Accents open the leaves').toBeGreaterThan(.4)
  expect(difference(bass, 66, 94, 42, 66), 'Bass unfolds the leaves').toBeGreaterThan(.8)
  expect(difference(middle, 24, 62, 16, 42), 'Midrange changes the cloud spacing').toBeGreaterThan(.8)
  expect(difference(treble, 26, 134, 66, 79), 'Treble reshapes the water').toBeGreaterThan(.8)
  expect(difference(treble, 24, 62, 16, 42), 'Treble does not shake the clouds').toBeLessThan(.1)
  expect(difference(accent, 0, 15, 0, 90), 'The white mat remains still').toBe(0)
})

test('three-part navigation leaves earlier artworks untouched and statements remain accessible', async ({ page }) => {
  for (const [file, hash] of [
    ['src/artwork.frag', 'b64a5521c934098723f5f9bf49d334ca8f3f9bc671e61e3d88dd6fa89a5c032e'],
    ['src/part-two.frag', 'a8922a54b7de475f88c5a1208fcf0a0a203db5fc3e82bdb545f3ba092fb19a38'],
  ]) expect(createHash('sha256').update(await readFile(file)).digest('hex')).toBe(hash)
  await ready(page)
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    await page.getByRole('button', { name: 'About the art and music' }).click()
    await expect(page.locator('#ai-statement')).toContainText('Clouds drift, leaves unfold')
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([])
    await page.getByRole('button', { name: 'Close art and music statement' }).click()
  }
  for (const [part, title, track] of [['Part I', 'Tantra', 'Tanta'], ['Part II', 'Tantra Part 2', 'Anc Egyptian Trance'], ['Part III', 'Tantra Part 3', 'Benju']]) {
    await page.getByRole('link', { name: part, exact: true }).click()
    await expect(page.locator('#app')).toHaveAttribute('data-audio-ready', 'true', { timeout: 30000 })
    await expect(page.locator('h1')).toHaveText(title)
    await expect(page.locator('.track-name')).toHaveText(track)
    await expect(page.locator('#painting')).toHaveAttribute('data-playing', 'false')
    await expect(page.locator('#notice')).toBeHidden()
  }
})

test('Benju falls back locally when the browser cannot decode AAC', async ({ page }) => {
  const requests: string[] = []
  page.on('request', request => requests.push(request.url()))
  await page.route('**/audio/Benju.m4a', route => route.fulfill({ status: 200, contentType: 'audio/mp4', body: 'Undecodable AAC fixture' }))
  await ready(page)
  expect(Number(await page.locator('#seek').getAttribute('max'))).toBeCloseTo(215.361917, 2)
  expect(requests.filter(url => url.endsWith('/audio/Benju.flac'))).toHaveLength(1)
  expect(requests.some(url => /Tanta\.mp3|Anc%20Egyptian/.test(url))).toBe(false)
  await at(page, 102)
  expect(Number(await page.locator('#painting').getAttribute('data-energy'))).toBeGreaterThan(.3)
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled()
})

test('Part 3 fullscreen opens silently for six seconds before playing Benju', async ({ page, browserName }, testInfo) => {
  test.skip(browserName !== 'chromium', 'Native fullscreen verified in Chromium.')
  await page.setViewportSize({ width: 800, height: 600 })
  await page.clock.install(); await ready(page)
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100))
  await page.locator('#seek').fill('165'); await page.clock.runFor(32)
  await page.getByRole('button', { name: 'Fullscreen', exact: true }).click()
  await expect(page.locator('#presentation')).toHaveAttribute('data-opening-started', 'true')
  await expect(page.locator('#opening')).toHaveAccessibleName(/Tantra Part 3 lets music become a quiet landscape/)
  await page.clock.runFor(32)
  await page.screenshot({ path: testInfo.outputPath('part3-opening.png') })
  await page.clock.runFor(5900)
  await expect(page.locator('#opening')).toBeVisible()
  await expect(page.locator('#painting')).toHaveAttribute('data-playing', 'false')
  await page.clock.runFor(150)
  await expect(page.locator('#opening')).toBeHidden()
  await expect(page.locator('#painting')).toHaveAttribute('data-playing', 'true')
  expect(Number(await page.locator('#painting').getAttribute('data-time'))).toBeLessThan(1)
  await page.screenshot({ path: testInfo.outputPath('part3-fullscreen.png') })
  await page.keyboard.press('Escape')
})