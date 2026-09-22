import firstShader from './artwork.frag?raw'
import secondShader from './part-two.frag?raw'
import thirdShader from './part-three.frag?raw'
import { statementBody } from './opening'

export const parts = [
  { id: '1', title: 'Tantra', track: 'Tanta', file: 'Tanta.mp3', filename: 'Tantra', shader: firstShader, duration: 149.893, statement: statementBody },
  { id: '2', title: 'Tantra Part 2', track: 'Anc Egyptian Trance', file: 'Anc Egyptian Trance.mp3', filename: 'Tantra-Part-2', shader: secondShader, duration: 181.5735,
    statement: 'Tantra Part 2 turns the pulse of music into an unfolding geometry. Stepped triangles rise towards a circular centre, open into interlocking forms, and gather back into stillness. Pyramid-like shapes become a study of balance, rhythm and colour.' },
  { id: '3', title: 'Tantra Part 3', track: 'Benju', file: 'Benju.m4a', fallbackFile: 'Benju.flac', filename: 'Tantra-Part-3', shader: thirdShader, duration: 215.361917,
    statement: 'Tantra Part 3 lets music become a quiet landscape. Clouds drift, leaves unfold, and ripples carry the rhythm across water. Nature and geometry meet in a slow breath, opening into warmth before settling into stillness.' },
] as const
export const currentPart = parts.find(part => part.id === new URLSearchParams(location.search).get('part')) ?? parts[0]