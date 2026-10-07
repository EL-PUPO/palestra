import { describe, expect, it } from 'vitest'
import { leggiId3, nomeDaFile } from './tagAudio'

/** Crea un piccolo tag ID3v2.3 con i frame indicati (testo UTF-8 o ISO-8859-1) */
function tagId3(frame: Record<string, string>, codifica = 3): Uint8Array {
  const corpi = Object.entries(frame).map(([id, testo]) => {
    const t = codifica === 3 ? new TextEncoder().encode(testo) : Uint8Array.from([...testo].map((c) => c.charCodeAt(0)))
    const f = new Uint8Array(10 + 1 + t.length)
    f.set([...id].map((c) => c.charCodeAt(0)), 0)
    new DataView(f.buffer).setUint32(4, 1 + t.length)
    f[10] = codifica
    f.set(t, 11)
    return f
  })
  const dimensione = corpi.reduce((n, c) => n + c.length, 0)
  const tag = new Uint8Array(10 + dimensione)
  tag.set([0x49, 0x44, 0x33, 3, 0, 0], 0)
  tag.set([(dimensione >> 21) & 0x7f, (dimensione >> 14) & 0x7f, (dimensione >> 7) & 0x7f, dimensione & 0x7f], 6)
  let pos = 10
  for (const c of corpi) {
    tag.set(c, pos)
    pos += c.length
  }
  return tag
}

describe('tag dei file musicali', () => {
  it('legge titolo e artista da un tag ID3', () => {
    expect(leggiId3(tagId3({ TIT2: 'Heroes Tonight', TPE1: 'Janji' }))).toEqual({ titolo: 'Heroes Tonight', artista: 'Janji' })
    expect(leggiId3(tagId3({ TIT2: 'Perché sì' }))).toEqual({ titolo: 'Perché sì' })
    expect(leggiId3(tagId3({ TPE1: 'Città' }, 0))).toEqual({ artista: 'Città' })
  })

  it('ignora i file senza tag', () => {
    expect(leggiId3(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]))).toEqual({})
  })

  it('ricava artista e titolo dal nome del file', () => {
    expect(nomeDaFile('Janji - Heroes Tonight (feat. Johnning).mp3')).toEqual({ artista: 'Janji', titolo: 'Heroes Tonight (feat. Johnning)' })
    expect(nomeDaFile('allenamento_gambe_01.m4a')).toEqual({ titolo: 'allenamento gambe 01' })
  })
})
