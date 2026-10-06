/** Legge un numero scritto all'italiana ("62,5") o all'inglese ("62.5") */
export function leggiNumero(testo: string | number | undefined | null): number | undefined {
  if (testo === undefined || testo === null) return undefined
  if (typeof testo === 'number') return Number.isFinite(testo) ? testo : undefined
  const pulito = testo.trim().replace(',', '.')
  if (pulito === '') return undefined
  const n = Number(pulito)
  return Number.isFinite(n) ? n : undefined
}

export function numero(n: number | undefined, decimali = 2): string {
  if (n === undefined || !Number.isFinite(n)) return '–'
  return n.toLocaleString('it-IT', { maximumFractionDigits: decimali })
}

export function kg(n: number | undefined): string {
  return n === undefined ? '–' : `${numero(n)} kg`
}

/** 90 → "1:30" */
export function mmss(secondi: number): string {
  const s = Math.max(0, Math.round(secondi))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** 90 → "1'30\"", 60 → "1'", 45 → "45\"" */
export function recupero(secondi: number | undefined): string {
  if (!secondi) return ''
  const m = Math.floor(secondi / 60)
  const s = secondi % 60
  if (m === 0) return `${s}"`
  return s ? `${m}'${String(s).padStart(2, '0')}"` : `${m}'`
}

export function durataLeggibile(ms: number): string {
  const min = Math.round(ms / 60000)
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`
}

/** Data locale in formato AAAA-MM-GG */
export function chiaveGiorno(d: Date | number = new Date()): string {
  const x = typeof d === 'number' ? new Date(d) : d
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

export function daChiaveGiorno(chiave: string): Date {
  const [a, m, g] = chiave.split('-').map(Number)
  return new Date(a, m - 1, g)
}

export function dataBreve(d: Date | number | string): string {
  const x = typeof d === 'string' ? daChiaveGiorno(d) : new Date(d)
  return x.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function dataLunga(d: Date | number | string): string {
  const x = typeof d === 'string' ? daChiaveGiorno(d) : new Date(d)
  return x.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export function ora(d: number): string {
  return new Date(d).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
}

export function giorniFa(d: number): string {
  const oggi = daChiaveGiorno(chiaveGiorno()).getTime()
  const quel = daChiaveGiorno(chiaveGiorno(d)).getTime()
  const g = Math.round((oggi - quel) / 86400000)
  if (g === 0) return 'oggi'
  if (g === 1) return 'ieri'
  return `${g} giorni fa`
}

/** "PANCA PIANA" → "Panca piana"; "lat machine" → "Lat machine" */
export function maiuscolaIniziale(testo: string): string {
  const t = testo.trim()
  if (!t) return t
  const lettere = t.replace(/[^a-zà-ÿ]/gi, '')
  const tuttoMaiuscolo = lettere.length >= 2 && lettere === lettere.toUpperCase()
  const base = tuttoMaiuscolo ? t.toLowerCase() : t
  return base.charAt(0).toUpperCase() + base.slice(1)
}

/** Per confrontare nomi di esercizi: minuscolo, senza accenti né punteggiatura */
export function normalizzaNome(nome: string): string {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}
