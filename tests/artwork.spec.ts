import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { readFile } from 'node:fs/promises'

async function ready(page: Page) {
  await page.goto('/')
  await expect(page.locator('#app')).toHaveAttribute('data-audio-ready', 'true', { timeout: 30000 })
  await expect(page.locator('#painting')).toHaveAttribute('data-ready', 'true')
  await page.evaluate(() => document.fonts.ready)
}
async function at(page: Page, time: number) {
  await page.locator('#seek').fill(String(time))
  await expect(page.locator('#painting')).toHaveAttribute('data-time', time.toFixed(3))
}
async function pixels(page: Page) {
  return page.locator('#painting').evaluate((canvas: HTMLCanvasElement) => {
    const sample = document.createElement('canvas'); sample.width = 160; sample.height = 90
    const context = sample.getContext('2d')!; context.drawImage(canvas, 0, 0, 160, 90)
    const data = [...context.getImageData(0, 0, 160, 90).data]
    let coloured = 0, border = 0, cleanBorder = 0
    for (let row = 0; row < 90; row++) for (let column = 0; column < 160; column++) {
      const offset = (row * 160 + column) * 4
      const values = data.slice(offset, offset + 3)
      if (Math.max(...values) - Math.min(...values) > 35) coloured++
      if (column < 15 || column > 144 || row < 6 || row > 83) { border++; if (Math.min(...values) > 230) cleanBorder++ }
    }
    return { data, colour: coloured / (160 * 90), whiteBorder: cleanBorder / border }
  })
}

test('real track produces distinct framed compositions and deterministic seeks', async ({ page }, testInfo) => {
  test.setTimeout(120000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await ready(page)
  expect(Number(await page.locator('#seek').getAttribute('max'))).toBeCloseTo(149.893, 1)
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible()
  for (const [width, height] of [[1440, 1000], [390, 844], [320, 640], [844, 430]]) {
    await page.setViewportSize({ width, height })
    const signatures = []
    for (const time of [0, 42, 78, 124, 149]) {
      await at(page, time)
      const sample = await pixels(page)
      expect(sample.colour).toBeGreaterThan(.20)
      expect(sample.whiteBorder).toBeGreaterThan(.99)
      signatures.push(sample.data.join(','))
      if (time === 124) await page.screenshot({ path: testInfo.outputPath(`artwork-${width}.png`) })
    }
    expect(new Set(signatures).size).toBe(5)
    await at(page, 42)
    expect((await pixels(page)).data.join(',')).toBe(signatures[1])
    const geometry = await page.evaluate(() => {
      const canvas = document.querySelector('#painting')!.getBoundingClientRect()
      const controls = [...document.querySelectorAll<HTMLElement>('button,input,h1,.credit')].filter(element => element.getBoundingClientRect().width)
      return { ratio: canvas.width / canvas.height, overflow: document.documentElement.scrollWidth > innerWidth, clipped: controls.some(element => { const box = element.getBoundingClientRect(); return box.left < 0 || box.right > innerWidth + 1 || box.top < 0 || box.bottom > innerHeight + 1 }) }
    })
    expect(geometry.ratio).toBeCloseTo(16 / 9, 2)
    expect(geometry.overflow).toBe(false); expect(geometry.clipped).toBe(false)
  }
  expect(errors).toEqual([])
})

test('ending returns to the resting composition and holds without a final jump', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 960, height: 720 })
  await ready(page)
  await page.locator('#motion').uncheck()
  const resting = await pixels(page)
  await page.locator('#motion').check()
  const distance = (first: number[], second: number[]) => first.reduce((sum, value, index) => sum + Math.abs(value - second[index]), 0) / first.length
  const states = new Map<number, number[]>()
  for (const time of [125.95, 126, 126.05, 136, 144, 146.9, 147, 149]) {
    await at(page, time)
    const sample = await pixels(page)
    expect(sample.whiteBorder).toBeGreaterThan(.99)
    states.set(time, sample.data)
    if ([126, 136, 144, 149].includes(time)) await page.screenshot({ path: testInfo.outputPath(`closing-${time}.png`) })
  }
  expect(distance(states.get(126)!, resting.data)).toBeGreaterThan(8)
  expect(distance(states.get(144)!, resting.data)).toBeLessThan(distance(states.get(136)!, resting.data))
  expect(distance(states.get(126)!, states.get(126.05)!)).toBeLessThan(4)
  expect(distance(states.get(146.9)!, resting.data)).toBeLessThan(.5)
  expect(states.get(147)).toEqual(resting.data)
  expect(states.get(149)).toEqual(resting.data)
})

test('playback drives pixels, pause holds, restart and volume work, hidden page stops', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 600 })
  await ready(page)
  await at(page, 72)
  const before = await pixels(page)
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect.poll(async () => Number(await page.locator('#painting').getAttribute('data-time'))).toBeGreaterThan(72.4)
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  const paused = await pixels(page)
  expect(paused.data).not.toEqual(before.data)
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  expect((await pixels(page)).data).toEqual(paused.data)
  await page.getByRole('button', { name: 'Mute', exact: true }).click()
  await expect(page.locator('#volume')).toHaveValue('0')
  await page.getByRole('button', { name: 'Unmute', exact: true }).click()
  await expect(page.locator('#volume')).toHaveValue('0.75')
  await page.getByRole('button', { name: 'Restart', exact: true }).click()
  await expect(page.locator('#painting')).toHaveAttribute('data-time', '0.000')
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')) })
  await expect(page.locator('#painting')).toHaveAttribute('data-playing', 'false')
})

test('reduced motion gives a still painting and both responsive layouts pass accessibility', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await ready(page)
  await expect(page.locator('#motion')).not.toBeChecked()
  const first = await pixels(page)
  await page.locator('#seek').fill('120')
  await expect(page.locator('#elapsed')).toHaveText('2:00')
  expect((await pixels(page)).data).toEqual(first.data)
  await page.locator('#motion').check()
  await expect(page.locator('#painting')).toHaveAttribute('data-time', '120.000')
  expect((await pixels(page)).data).not.toEqual(first.data)
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 })
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([])
  }
})

test('fullscreen keeps the 16:9 white frame at different aspect ratios', async ({ browser, browserName }, testInfo) => {
  test.skip(browserName !== 'chromium', 'Native fullscreen verified in Chromium.')
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    const context = await browser.newContext({ viewport: { width, height } })
    try {
      const page = await context.newPage(); await ready(page); await at(page, 124)
      await page.getByRole('button', { name: 'Fullscreen', exact: true }).click()
      await expect.poll(() => page.evaluate(() => document.fullscreenElement?.id)).toBe('presentation')
      await expect(page.locator('#opening')).toBeVisible()
      await expect(page.locator('#painting')).toHaveAttribute('data-playing', 'false')
      const bounds = (await page.locator('#painting').boundingBox())!
      expect(bounds.width / bounds.height).toBeCloseTo(16 / 9, 2)
      expect(bounds.width).toBeLessThanOrEqual(width + 1); expect(bounds.height).toBeLessThanOrEqual(height + 1)
      expect((await pixels(page)).whiteBorder).toBeGreaterThan(.99)
      await page.screenshot({ path: testInfo.outputPath(`fullscreen-${width}.png`) })
      await page.keyboard.press('Escape')
      await expect.poll(() => page.evaluate(() => document.fullscreenElement)).toBeNull()
      await expect(page.locator('#opening')).toBeHidden()
    } finally { await context.close() }
  }
})

test('fullscreen opening is silent for six seconds then starts the full track at zero', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Native fullscreen verified in Chromium.')
  await page.setViewportSize({ width: 640, height: 480 })
  await page.clock.install(); await ready(page)
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100))
  await page.locator('#seek').fill('110'); await page.clock.runFor(32)
  await page.getByRole('button', { name: 'Fullscreen', exact: true }).click()
  await expect(page.locator('#presentation')).toHaveAttribute('data-opening-started', 'true')
  await page.clock.runFor(32)
  await expect(page.locator('#painting')).toHaveAttribute('data-time', '0.000')
  await expect(page.locator('#opening')).toBeVisible()
  await page.clock.runFor(5900)
  await expect(page.locator('#painting')).toHaveAttribute('data-playing', 'false')
  await expect(page.locator('#opening')).toBeVisible()
  await page.clock.runFor(150)
  await expect(page.locator('#painting')).toHaveAttribute('data-playing', 'true')
  await expect(page.locator('#opening')).toBeHidden()
  expect(Number(await page.locator('#painting').getAttribute('data-time'))).toBeLessThan(1)
  await page.keyboard.press('Escape')
})

test('exiting fullscreen during the statement cancels delayed playback', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Native fullscreen verified in Chromium.')
  await page.clock.install(); await ready(page)
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100))
  await page.getByRole('button', { name: 'Fullscreen', exact: true }).click()
  await expect(page.locator('#opening')).toBeVisible()
  await page.clock.runFor(2000); await page.keyboard.press('Escape')
  await expect(page.locator('#opening')).toBeHidden()
  await page.clock.runFor(7000)
  await expect(page.locator('#painting')).toHaveAttribute('data-playing', 'false')
})

test('still export includes the 1920x1080 frame and restores canvas dimensions', async ({ page }) => {
  await ready(page); await at(page, 78)
  const dimensions = () => page.locator('#painting').evaluate((canvas: HTMLCanvasElement) => [canvas.width, canvas.height])
  const before = await dimensions()
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save frame' }).click()
  const download = await pending
  const data = await readFile((await download.path())!)
  expect(data.subarray(1, 4).toString()).toBe('PNG')
  expect(data.readUInt32BE(16)).toBe(1920); expect(data.readUInt32BE(20)).toBe(1080)
  await expect.poll(dimensions).toEqual(before)
})

test('Tantra title and info icon disclose readable statements by hover, keyboard and tap', async ({ page, browserName }, testInfo) => {
  await ready(page)
  await expect(page).toHaveTitle('Tantra / Art by Tejj')
  await expect(page.locator('h1')).toHaveText('Tantra')
  const title = page.getByRole('button', { name: 'Tantra artist statement', exact: true })
  const artist = page.locator('#art-statement')
  const process = page.locator('#ai-statement')
  const info = page.getByRole('button', { name: 'About the art and music' })
  await expect(info.locator('svg.lucide-info')).toHaveCount(1)
  await expect(page.locator('svg.lucide-sparkles')).toHaveCount(0)
  const originalBounds = await page.locator('#painting').boundingBox()
  await title.hover()
  await expect(artist).toBeVisible()
  await artist.hover()
  await expect(artist).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(artist).toBeHidden()
  await expect(title).toBeFocused()
  await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab')
  await expect(process).toBeVisible()
  await expect(artist).toBeHidden()
  await expect(process).toContainText('What if music and code could generate a Neo-Tantric artwork?')
  await expect(process).toContainText('Sound becomes colour, rhythm becomes movement, and code gives them form.')
  expect(await process.locator('p').allTextContents()).toEqual(await artist.locator('p').allTextContents())
  await expect(process).not.toContainText(/AI|coding|supplied|generated video/)
  expect(await page.locator('#painting').boundingBox()).toEqual(originalBounds)
  for (const [width, height] of [[1440, 1000], [390, 844], [320, 640], [844, 430]]) {
    await page.setViewportSize({ width, height })
    const titleBounds = (await title.boundingBox())!
    const infoBounds = (await info.boundingBox())!
    const iconBounds = (await info.locator('svg').boundingBox())!
    expect(infoBounds.x - titleBounds.x - titleBounds.width).toBeCloseTo(0, 1)
    expect(iconBounds.x - titleBounds.x - titleBounds.width).toBeLessThanOrEqual(12)
    expect(infoBounds.width).toBe(40)
    await info.click()
    const bounds = (await process.boundingBox())!
    expect(bounds.x).toBeGreaterThanOrEqual(0)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width)
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(height)
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([])
    await page.screenshot({ path: testInfo.outputPath(`process-${width}.png`) })
    await page.getByRole('button', { name: 'Close art and music statement' }).click()
    await expect(process).toBeHidden()
    await title.click()
    await expect(artist).toBeVisible()
    await page.locator('.track-name').click()
    await expect(artist).toBeHidden()
  }
  await page.locator('#play').focus()
  await title.focus()
  await expect(artist).toBeVisible()
  await page.getByRole('button', { name: 'Close artist statement' }).click()
  await expect(artist).toBeHidden()
})

test('missing soundtrack reports an error without enabling playback', async ({ page }) => {
  await page.route('**/audio/Tanta.mp3', route => route.fulfill({ status: 404, body: 'Missing' }))
  await page.goto('/')
  await expect(page.locator('#notice')).toContainText('soundtrack could not load')
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeDisabled()
  await expect(page.locator('#painting')).toHaveAttribute('data-ready', 'true')
})