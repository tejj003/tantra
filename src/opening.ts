export const openingSeconds = 6
export const statementQuestion = 'What if music and code could generate a Neo-Tantric artwork?'
export const statementBody = 'Tantra explores that possibility. Sound becomes colour, rhythm becomes movement, and code gives them form. The artwork unfolds with the music, then gathers back into stillness.'
export const statementCredit = 'Art & music by Tejj'

export function drawOpening(canvas: HTMLCanvasElement, bodyText = statementBody) {
  const context = canvas.getContext('2d')!
  const width = canvas.width, height = canvas.height
  context.fillStyle = '#ffffff'; context.fillRect(0, 0, width, height)
  context.save(); context.scale(width / 1920, height / 1080)
  context.fillStyle = '#000000'; context.textAlign = 'center'; context.textBaseline = 'top'
  const lines = (text: string, font: string, maximum: number) => {
    context.font = font
    const result: string[] = []
    let line = ''
    for (const word of text.split(' ')) {
      const next = line ? `${line} ${word}` : word
      if (line && context.measureText(next).width > maximum) { result.push(line); line = word }
      else line = next
    }
    if (line) result.push(line)
    return result
  }
  const question = lines(statementQuestion, '500 64px "Cormorant Garamond"', 1250)
  const body = lines(bodyText, '400 32px "DM Sans"', 1180)
  const blockHeight = question.length * 74 + 52 + body.length * 49 + 68 + 32
  let top = (1080 - blockHeight) / 2
  context.font = '500 64px "Cormorant Garamond"'
  for (const line of question) { context.fillText(line, 960, top); top += 74 }
  top += 52
  context.font = '400 32px "DM Sans"'
  for (const line of body) { context.fillText(line, 960, top); top += 49 }
  top += 68
  context.font = '400 27px "DM Sans"'; context.fillText(statementCredit, 960, top)
  context.restore()
}

export class OpeningClock {
  private elapsed = 0
  private previous: number | null = null
  active = false
  start() { this.elapsed = 0; this.previous = null; this.active = true }
  cancel() { this.active = false; this.previous = null }
  advance(timestamp: number) {
    if (!this.active) return false
    if (this.previous !== null) this.elapsed += Math.max(0, timestamp - this.previous) / 1000
    this.previous = timestamp
    if (this.elapsed < openingSeconds) return false
    this.cancel()
    return true
  }
}