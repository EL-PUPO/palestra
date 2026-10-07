import type { LinkYouTube } from './musica'

/** Le parti del lettore di YouTube (IFrame Player API) che usa l'app */
export interface LettoreYouTube {
  playVideo(): void
  pauseVideo(): void
  nextVideo(): void
  previousVideo(): void
  playVideoAt(indice: number): void
  setShuffle(mescola: boolean): void
  setLoop(ripeti: boolean): void
  getPlayerState(): number
  getPlaylist(): string[] | null
  getPlaylistIndex(): number
  getVideoData(): { title?: string; author?: string; video_id?: string }
  getCurrentTime(): number
  getDuration(): number
  seekTo(secondi: number, caricaAvanti: boolean): void
  destroy(): void
}

export const STATO = { finito: 0, inRiproduzione: 1, inPausa: 2, caricamento: 3, pronto: 5 } as const

interface OpzioniLettore {
  width?: string | number
  height?: string | number
  videoId?: string
  playerVars?: Record<string, string | number>
  events?: {
    onReady?: (e: { target: LettoreYouTube }) => void
    onStateChange?: (e: { data: number; target: LettoreYouTube }) => void
    onError?: (e: { data: number; target: LettoreYouTube }) => void
  }
}

interface ApiYouTube {
  Player: new (elemento: HTMLElement, opzioni: OpzioniLettore) => LettoreYouTube
}

declare global {
  interface Window {
    YT?: ApiYouTube
    onYouTubeIframeAPIReady?: () => void
  }
}

let caricamento: Promise<ApiYouTube> | undefined

/** Carica una volta sola lo script ufficiale di YouTube */
export function caricaYouTube(): Promise<ApiYouTube> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  caricamento ??= new Promise<ApiYouTube>((ok, ko) => {
    const precedente = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      precedente?.()
      ok(window.YT!)
    }
    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    script.async = true
    script.onerror = () => {
      caricamento = undefined
      ko(new Error('YouTube non raggiungibile'))
    }
    document.head.appendChild(script)
  })
  return caricamento
}

const titoli = new Map<string, string>()

/** Titolo di un video o di una playlist (servizio pubblico oEmbed di YouTube, senza chiavi) */
async function titoloOEmbed(indirizzo: string): Promise<string | undefined> {
  if (titoli.has(indirizzo)) return titoli.get(indirizzo)
  try {
    const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(indirizzo)}`)
    if (!r.ok) return undefined
    const dati = (await r.json()) as { title?: string }
    if (dati.title) titoli.set(indirizzo, dati.title)
    return dati.title
  } catch {
    return undefined
  }
}

export const titoloVideo = (id: string) => titoloOEmbed(`https://www.youtube.com/watch?v=${id}`)

/** Nome da dare a un link: titolo della playlist, "Mix · canzone" per i Mix automatici, o titolo del video */
export async function nomeDaLink(l: LinkYouTube): Promise<string | undefined> {
  if (l.lista && !l.lista.startsWith('RD')) {
    const t = await titoloOEmbed(`https://www.youtube.com/playlist?list=${l.lista}`)
    if (t) return t
  }
  if (!l.video) return undefined
  const t = await titoloVideo(l.video)
  return t && l.lista?.startsWith('RD') ? `Mix · ${t}` : t
}
