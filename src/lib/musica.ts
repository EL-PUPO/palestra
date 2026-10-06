/** Link di YouTube: video singolo e/o playlist */
export interface LinkYouTube {
  video?: string
  lista?: string
  musica: boolean
}

export function leggiLinkYouTube(link: string): LinkYouTube | undefined {
  let u: URL
  try {
    u = new URL(link.trim())
  } catch {
    return undefined
  }
  const host = u.hostname.replace(/^(www|m)\./, '')
  const lista = u.searchParams.get('list') || undefined
  let video: string | undefined
  if (host === 'youtu.be') video = u.pathname.slice(1).split('/')[0] || undefined
  else if (host === 'youtube.com' || host === 'music.youtube.com' || host === 'youtube-nocookie.com') {
    if (u.pathname === '/watch') video = u.searchParams.get('v') || undefined
    else video = /^\/(?:shorts|embed|live)\/([\w-]{6,})/.exec(u.pathname)?.[1]
  } else return undefined
  if (video === 'videoseries') video = undefined
  if (!video && !lista) return undefined
  return { video, lista, musica: host === 'music.youtube.com' }
}

/** Indirizzo del lettore da mettere dentro l'app */
export function urlLettore(l: LinkYouTube): string {
  const p = new URLSearchParams({ playsinline: '1', rel: '0' })
  if (l.lista) p.set('list', l.lista)
  return `https://www.youtube-nocookie.com/embed/${l.video ?? 'videoseries'}?${p}`
}

/** Indirizzo che apre direttamente l'app YouTube (o YouTube Music) sull'iPhone */
export function urlApp(link: string): string {
  const l = leggiLinkYouTube(link)
  if (!l) return link
  if (l.musica) return link
  const p = new URLSearchParams()
  if (l.video) p.set('v', l.video)
  if (l.lista) p.set('list', l.lista)
  return l.video ? `youtube://www.youtube.com/watch?${p}` : `youtube://www.youtube.com/playlist?${p}`
}

/** Tutti i link di YouTube in un testo incollato (anche più di uno, su righe diverse) */
export function linkNelTesto(testo: string): string[] {
  const trovati = testo.match(/https?:\/\/[^\s<>"']+/g) ?? []
  return [...new Set(trovati.map((t) => t.replace(/[),.;]+$/, '')).filter((t) => leggiLinkYouTube(t)))]
}

/** Due link sono la stessa playlist/video? */
export function stessoLink(a: string, b: string): boolean {
  const x = leggiLinkYouTube(a)
  const y = leggiLinkYouTube(b)
  return !!x && !!y && (x.lista ?? '') === (y.lista ?? '') && (x.lista ? true : x.video === y.video)
}
