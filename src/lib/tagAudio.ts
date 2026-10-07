/** Titolo e artista letti dai tag ID3 di un MP3 (se ci sono) */
export interface TagAudio {
  titolo?: string
  artista?: string
}

const intero = (b: Uint8Array, i: number) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0
const sincronizzato = (b: Uint8Array, i: number) => ((b[i] & 0x7f) << 21) | ((b[i + 1] & 0x7f) << 14) | ((b[i + 2] & 0x7f) << 7) | (b[i + 3] & 0x7f)

function testoDelFrame(corpo: Uint8Array): string {
  const codifica = ['iso-8859-1', 'utf-16', 'utf-16be', 'utf-8'][corpo[0]] ?? 'utf-8'
  return new TextDecoder(codifica).decode(corpo.subarray(1)).replace(/\0+/g, ' ').trim()
}

/** Legge i frame TIT2 (titolo) e TPE1 (artista) di un tag ID3v2.3/2.4 */
export function leggiId3(dati: Uint8Array): TagAudio {
  if (dati.length < 10 || dati[0] !== 0x49 || dati[1] !== 0x44 || dati[2] !== 0x33) return {}
  const versione = dati[3]
  if (versione !== 3 && versione !== 4) return {}
  const fine = Math.min(dati.length, 10 + sincronizzato(dati, 6))
  let pos = 10
  if (dati[5] & 0x40) pos += versione === 4 ? sincronizzato(dati, pos) : intero(dati, pos) + 4
  const tag: TagAudio = {}
  while (pos + 10 <= fine) {
    const id = String.fromCharCode(dati[pos], dati[pos + 1], dati[pos + 2], dati[pos + 3])
    if (!/^[A-Z0-9]{4}$/.test(id)) break
    const dimensione = versione === 4 ? sincronizzato(dati, pos + 4) : intero(dati, pos + 4)
    const corpo = dati.subarray(pos + 10, Math.min(fine, pos + 10 + dimensione))
    if (id === 'TIT2') tag.titolo = testoDelFrame(corpo) || undefined
    if (id === 'TPE1') tag.artista = testoDelFrame(corpo) || undefined
    pos += 10 + dimensione
  }
  return tag
}

export async function leggiTagFile(file: Blob): Promise<TagAudio> {
  try {
    const testa = new Uint8Array(await file.slice(0, 10).arrayBuffer())
    if (testa[0] !== 0x49 || testa[1] !== 0x44 || testa[2] !== 0x33) return {}
    const dimensione = 10 + sincronizzato(testa, 6)
    return leggiId3(new Uint8Array(await file.slice(0, dimensione).arrayBuffer()))
  } catch {
    return {}
  }
}

/** "Artista - Titolo (Official Audio).mp3" → { artista, titolo } */
export function nomeDaFile(nomeFile: string): TagAudio {
  const base = nomeFile
    .replace(/\.[a-z0-9]{2,4}$/i, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const parti = base.split(/\s[-–—]\s/)
  if (parti.length >= 2) return { artista: parti[0].trim(), titolo: parti.slice(1).join(' - ').trim() }
  return { titolo: base || 'Brano' }
}

/** Durata in secondi (dai metadati del file, senza leggerlo tutto) */
export function durataFile(file: Blob): Promise<number | undefined> {
  return new Promise((ok) => {
    const audio = document.createElement('audio')
    const url = URL.createObjectURL(file)
    const fine = (d?: number) => {
      URL.revokeObjectURL(url)
      ok(d && Number.isFinite(d) ? Math.round(d) : undefined)
    }
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => fine(audio.duration)
    audio.onerror = () => fine()
    setTimeout(() => fine(), 6000)
    audio.src = url
  })
}
