import { useSyncExternalStore } from 'react'
import { db, type Brano } from '../db'

/**
 * Lettore dei brani importati: un solo elemento <audio> per tutta l'app,
 * così la musica continua anche cambiando pagina. I comandi compaiono anche
 * nella schermata di blocco e nel Centro di Controllo (Media Session).
 */
export interface StatoLettoreLocale {
  coda: string[]
  indice: number
  inRiproduzione: boolean
  casuale: boolean
  tempo: number
  durata: number
  titolo?: string
  artista?: string
  /** i comandi grandi sono visibili (altrimenti si mostra la barra piccola) */
  comandiVisibili: boolean
  /** il lettore di YouTube è aperto: la barra piccola dei brani si nasconde */
  youtubeAperto: boolean
}

let stato: StatoLettoreLocale = {
  coda: [],
  indice: -1,
  inRiproduzione: false,
  casuale: false,
  tempo: 0,
  durata: 0,
  comandiVisibili: false,
  youtubeAperto: false,
}
const ascoltatori = new Set<() => void>()

function aggiorna(modifiche: Partial<StatoLettoreLocale>) {
  stato = { ...stato, ...modifiche }
  ascoltatori.forEach((a) => a())
}

export function useLettoreLocale(): StatoLettoreLocale {
  return useSyncExternalStore(
    (cb) => {
      ascoltatori.add(cb)
      return () => ascoltatori.delete(cb)
    },
    () => stato,
  )
}

const audio: HTMLAudioElement | undefined = typeof Audio !== 'undefined' ? new Audio() : undefined
let urlCorrente: string | undefined
let sbloccato = false

/** Un attimo di silenzio, per "sbloccare" l'audio dell'iPhone al primo tocco */
function urlSilenzio(): string {
  const campioni = 800
  const b = new DataView(new ArrayBuffer(44 + campioni))
  const scrivi = (o: number, t: string) => [...t].forEach((c, i) => b.setUint8(o + i, c.charCodeAt(0)))
  scrivi(0, 'RIFF')
  b.setUint32(4, 36 + campioni, true)
  scrivi(8, 'WAVEfmt ')
  b.setUint32(16, 16, true)
  b.setUint16(20, 1, true)
  b.setUint16(22, 1, true)
  b.setUint32(24, 8000, true)
  b.setUint32(28, 8000, true)
  b.setUint16(32, 1, true)
  b.setUint16(34, 8, true)
  scrivi(36, 'data')
  b.setUint32(40, campioni, true)
  for (let i = 0; i < campioni; i++) b.setUint8(44 + i, 128)
  return URL.createObjectURL(new Blob([b], { type: 'audio/wav' }))
}

/** Da chiamare dentro un tocco dell'utente, prima di qualunque attesa */
function sblocca() {
  if (sbloccato || !audio) return
  sbloccato = true
  audio.src = urlSilenzio()
  audio.play().catch((e: Error) => {
    // "AbortError" = il brano vero è arrivato prima della fine del silenzio: va bene così
    if (e.name === 'NotAllowedError') sbloccato = false
  })
}

function aggiornaSchermataDiBlocco(b: Brano) {
  if (!('mediaSession' in navigator)) return
  navigator.mediaSession.metadata = new MediaMetadata({
    title: b.titolo,
    artist: b.artista ?? '',
    album: 'Palestra',
    artwork: [{ src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' }],
  })
}

async function carica(indice: number, avvia: boolean) {
  const id = stato.coda[indice]
  if (!id || !audio) return
  const b = await db.brani.get(id)
  if (!b) {
    // brano eliminato nel frattempo
    aggiorna({ coda: stato.coda.filter((x) => x !== id) })
    if (stato.coda.length) await carica(Math.min(indice, stato.coda.length - 1), avvia)
    else ferma()
    return
  }
  if (urlCorrente) URL.revokeObjectURL(urlCorrente)
  urlCorrente = URL.createObjectURL(b.file)
  audio.src = urlCorrente
  aggiorna({ indice, titolo: b.titolo, artista: b.artista, tempo: 0, durata: b.durata ?? 0 })
  aggiornaSchermataDiBlocco(b)
  if (avvia) {
    try {
      await audio.play()
    } catch {
      aggiorna({ inRiproduzione: false })
    }
  }
}

/** Suona la coda di brani partendo da quello scelto */
export function suonaBrani(coda: string[], indice: number) {
  sblocca()
  aggiorna({ coda })
  void carica(indice, true)
}

export function playPausa() {
  if (!audio) return
  sblocca()
  if (stato.indice < 0) return
  if (audio.paused) {
    if (!urlCorrente) void carica(stato.indice, true)
    else void audio.play().catch(() => aggiorna({ inRiproduzione: false }))
  } else audio.pause()
}

export function pausaLocale() {
  audio?.pause()
}

function prossimoIndice(): number {
  const n = stato.coda.length
  if (!n) return -1
  if (stato.casuale && n > 1) {
    let i = stato.indice
    while (i === stato.indice) i = Math.floor(Math.random() * n)
    return i
  }
  return (stato.indice + 1) % n
}

export function avanti() {
  sblocca()
  const i = prossimoIndice()
  if (i >= 0) void carica(i, true)
}

export function indietro() {
  sblocca()
  if (!audio) return
  if (audio.currentTime > 3 || stato.coda.length < 2) {
    audio.currentTime = 0
    return
  }
  void carica((stato.indice - 1 + stato.coda.length) % stato.coda.length, true)
}

export function vaiA(secondi: number) {
  if (!audio || !Number.isFinite(secondi)) return
  audio.currentTime = Math.max(0, Math.min(audio.duration || secondi, secondi))
  aggiorna({ tempo: audio.currentTime })
}

export function cambiaCasuale() {
  aggiorna({ casuale: !stato.casuale })
}

/** Ferma la musica e chiude il lettore */
export function ferma() {
  audio?.pause()
  if (audio) audio.removeAttribute('src')
  if (urlCorrente) URL.revokeObjectURL(urlCorrente)
  urlCorrente = undefined
  aggiorna({ coda: [], indice: -1, inRiproduzione: false, tempo: 0, durata: 0, titolo: undefined, artista: undefined })
  if ('mediaSession' in navigator) navigator.mediaSession.metadata = null
}

export function impostaComandiVisibili(visibili: boolean) {
  if (stato.comandiVisibili !== visibili) aggiorna({ comandiVisibili: visibili })
}

export function impostaYoutubeAperto(aperto: boolean) {
  if (stato.youtubeAperto !== aperto) aggiorna({ youtubeAperto: aperto })
}

if (audio) {
  audio.preload = 'auto'
  audio.addEventListener('play', () => {
    if (urlCorrente) aggiorna({ inRiproduzione: true })
  })
  audio.addEventListener('pause', () => aggiorna({ inRiproduzione: false }))
  audio.addEventListener('timeupdate', () => {
    if (urlCorrente) aggiorna({ tempo: audio.currentTime })
  })
  audio.addEventListener('loadedmetadata', () => {
    if (!urlCorrente || !Number.isFinite(audio.duration)) return
    aggiorna({ durata: audio.duration })
    const id = stato.coda[stato.indice]
    if (id) void db.brani.update(id, { durata: Math.round(audio.duration) })
  })
  audio.addEventListener('ended', () => {
    if (urlCorrente) avanti()
  })

  if ('mediaSession' in navigator) {
    const azioni: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', () => playPausa()],
      ['pause', () => audio.pause()],
      ['previoustrack', () => indietro()],
      ['nexttrack', () => avanti()],
      ['seekbackward', () => vaiA(audio.currentTime - 10)],
      ['seekforward', () => vaiA(audio.currentTime + 10)],
      ['seekto', (d) => vaiA(d.seekTime ?? 0)],
    ]
    for (const [azione, gestore] of azioni) {
      try {
        navigator.mediaSession.setActionHandler(azione, gestore)
      } catch {
        // azione non supportata da questo browser
      }
    }
  }
}
