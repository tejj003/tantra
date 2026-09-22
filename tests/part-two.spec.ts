import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

async function ready(page: Page) {
  await page.goto('/?part=2')
  await expect(page.locator('#app')).toHaveAttribute('data-audio-ready', 'true', { timeout: 30000 })
  await expect(page.locator('#notice')).toBeHidden()
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
    let colour = 0, border = 0, white = 0
    for (let row = 0; row < 90; row++) for (let column = 0; column < 160; column++) {
      const offset = (row * 160 + column) * 4
      const values = data.slice(offset, offset + 3)
      if (Math.max(...values) - Math.min(...values) > 35) colour++
      if (row < 6 || row > 83 || column < 15 || column > 144) { border++; if (Math.min(...values) > 230) white++ }
    }
    return { data, colour: colour / 14400, border: white / border }
  })
}

test('Part 2 has its own music, distinct evolving art, and an intact white frame', async ({ page }, testInfo) => {
  test.setTimeout(120000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await ready(page)
  await expect(page).toHaveTitle('Tantra Part 2 / Art by Tejj')
  await expect(page.locator('h1')).toHaveText('Tantra Part 2')
  await expect(page.locator('.track-name')).toHaveText('Anc Egyptian Trance')
  expect(Number(await page.locator('#seek').getAttribute('max'))).toBeCloseTo(181.5735, 2)
  await expect(page.getByRole('link', { name: 'Part II', exact: true })).toHaveAttribute('aria-current', 'page')
  for (const [width, height] of [[1440, 1000], [390, 844], [320, 640], [844, 430]]) {
    await page.setViewportSize({ width, height })
    await expect.poll(() => page.locator('#painting').evaluate((canvas: HTMLCanvasElement) => {
      const bounds = canvas.getBoundingClientRect(), scale = Number(canvas.dataset.scale)
      return canvas.width === Math.floor(bounds.width * scale) && canvas.height === Math.floor(bounds.height * scale)
    })).toBe(true)
    const states = []
    for (const time of [0, 48, 94, 145, 167, 180]) {
      await at(page, time)
      const sample = await pixels(page)
      expect(sample.colour, `coloured artwork at ${time}`).toBeGreaterThan(.2)
      expect(sample.border).toBeGreaterThan(.99)
      states.push(sample.data.join(','))
      if ([0, 145, 180].includes(time)) await page.screenshot({ path: testInfo.outputPath(`part2-${width}-${time}.png`) })
    }
    expect(new Set(states).size).toBe(6)
    await at(page, 48)
    const original = states[1].split(',').map(Number)
    const differences = (await pixels(page)).data.map((value, index) => Math.abs(value - original[index]))
    expect(differences.reduce((total, value) => total + value, 0) / differences.length, `Repeatable seek at ${width}px`).toBeLessThan(.01)
    expect(Math.max(...differences)).toBeLessThanOrEqual(8)
    const geometry = await page.evaluate(() => {
      const canvas = document.querySelector('#painting')!.getBoundingClientRect()
      const controls = [...document.querySelectorAll<HTMLElement>('button,input,h1,.track-name,.part-selector a,.credit')].filter(element => element.getBoundingClientRect().width)
      return { ratio: canvas.width / canvas.height, overflow: document.documentElement.scrollWidth > innerWidth, clipped: controls.filter(element => { const box = element.getBoundingClientRect(); return box.left < 0 || box.right > innerWidth + 1 || box.bottom > innerHeight + 1 }).map(element => element.id || element.className) }
    })
    expect(geometry).toMatchObject({ overflow: false, clipped: [] })
    expect(geometry.ratio).toBeCloseTo(16 / 9, 2)
  }
  expect(errors).toEqual([])
})

test('Part 2 outlines reach the red frame and are clipped before the white mat', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1200, height: 900 })
  await ready(page)
  await page.locator('#motion').uncheck()
  const samples = await page.locator('#painting').evaluate((canvas: HTMLCanvasElement) => {
    const snapshot = document.createElement('canvas'); snapshot.width = canvas.width; snapshot.height = canvas.height
    const context = snapshot.getContext('2d')!; context.drawImage(canvas, 0, 0)
    const pixel = (worldX: number, worldY: number) => {
      const column = Math.round((.5 + worldX * .402 / (16 / 9)) * canvas.width)
      const row = Math.round((.5 - worldY * .402) * canvas.height)
      const data = context.getImageData(column - 1, row - 1, 3, 3).data
      let darkest = 255
      let green = 0
      for (let offset = 0; offset < data.length; offset += 4) {
        darkest = Math.min(darkest, data[offset], data[offset + 1], data[offset + 2])
        green = Math.max(green, data[offset + 1])
      }
      return { darkest, green }
    }
    const edges = [-1, 1].flatMap(side => [0, 1].map(layer => {
      const reach = (1.14 - layer * .064) * Math.SQRT2
      const insideX = .658 / .402, outsideX = .680 / .402
      const insideY = .12 + reach - insideX / 1.14
      const outsideY = .12 + reach - outsideX / 1.14
      return { line: pixel(side * insideX, insideY), background: pixel(side * insideX, insideY + .04), outside: pixel(side * outsideX, outsideY) }
    }))
    return { edges, clear: [pixel(-2.05, .12), pixel(2.05, .12), pixel(0, 1.18)] }
  })
  for (const edge of samples.edges) {
    expect(edge.line.green - edge.background.green).toBeGreaterThan(15)
    expect(edge.outside.darkest).toBeGreaterThan(230)
  }
  for (const sample of samples.clear) expect(sample.darkest).toBeGreaterThan(230)
  await page.screenshot({ path: testInfo.outputPath('clipped-diamond-outlines.png') })
})

test('Part 2 uses real audio energy, stops on pause and resolves to its resting geometry', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 600 })
  await ready(page)
  await at(page, 164)
  const before = await pixels(page)
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect.poll(async () => Number(await page.locator('#painting').getAttribute('data-time'))).toBeGreaterThan(164.4)
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  const after = await pixels(page)
  expect(after.data).not.toEqual(before.data)
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  expect((await pixels(page)).data).toEqual(after.data)
  expect(Number(await page.locator('#painting').getAttribute('data-energy'))).toBeGreaterThan(.5)
  await page.locator('#motion').uncheck()
  const resting = await pixels(page)
  await page.locator('#motion').check()
  await at(page, 180)
  expect((await pixels(page)).data).toEqual(resting.data)
  await at(page, 181)
  expect((await pixels(page)).data).toEqual(resting.data)
})

test('series navigation keeps Part 1 intact and Part 2 statement accessible', async ({ page }) => {
  expect(createHash('sha256').update(await readFile('src/artwork.frag')).digest('hex')).toBe('b64a5521c934098723f5f9bf49d334ca8f3f9bc671e61e3d88dd6fa89a5c032e')
  await ready(page); await at(page, 48)
  const second = await pixels(page)
  await page.getByRole('button', { name: 'About the art and music' }).click()
  await expect(page.locator('#ai-statement')).toContainText('Stepped triangles rise towards a circular centre')
  await page.getByRole('button', { name: 'Close art and music statement' }).click()
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([])
  }
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.getByRole('link', { name: 'Part I', exact: true }).click()
  await expect(page.locator('#app')).toHaveAttribute('data-audio-ready', 'true')
  await expect(page.locator('h1')).toHaveText('Tantra')
  await at(page, 48)
  expect((await pixels(page)).data).not.toEqual(second.data)
  await page.getByRole('link', { name: 'Part II', exact: true }).click()
  await expect(page.locator('#app')).toHaveAttribute('data-audio-ready', 'true')
  await expect(page.locator('#painting')).toHaveAttribute('data-playing', 'false')
  await at(page, 48)
  expect((await pixels(page)).data).toEqual(second.data)
})

test('Part 2 fullscreen has its own silent statement and starts its song at zero', async ({ page, browserName }, testInfo) => {
  test.skip(browserName !== 'chromium', 'Native fullscreen verified in Chromium.')
  await page.setViewportSize({ width: 800, height: 600 })
  await page.clock.install(); await ready(page)
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100))
  await page.locator('#seek').fill('130'); await page.clock.runFor(32)
  await page.getByRole('button', { name: 'Fullscreen', exact: true }).click()
  await expect(page.locator('#presentation')).toHaveAttribute('data-opening-started', 'true')
  await expect(page.locator('#opening')).toHaveAccessibleName(/Tantra Part 2 turns the pulse of music/)
  await page.clock.runFor(32)
  await page.screenshot({ path: testInfo.outputPath('part2-opening.png') })
  await page.clock.runFor(5900)
  await expect(page.locator('#painting')).toHaveAttribute('data-playing', 'false')
  await expect(page.locator('#opening')).toBeVisible()
  await page.clock.runFor(150)
  await expect(page.locator('#painting')).toHaveAttribute('data-playing', 'true')
  await expect(page.locator('#opening')).toBeHidden()
  expect(Number(await page.locator('#painting').getAttribute('data-time'))).toBeLessThan(1)
  await page.screenshot({ path: testInfo.outputPath('part2-fullscreen.png') })
  await page.keyboard.press('Escape')
})