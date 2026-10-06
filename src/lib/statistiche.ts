import type { Obiettivo, Sessione, SerieRegistrata, TipoEsercizio, VoceSessione } from '../db'

export interface Prestazione {
  sessione: Sessione
  voce: VoceSessione
}

export const serieFatte = (v: VoceSessione): SerieRegistrata[] => v.serie.filter((s) => s.esito !== null)

/** Massimale stimato (formula di Epley) */
export function massimaleStimato(kg: number, rip: number): number {
  if (!kg || !rip) return 0
  return rip === 1 ? kg : kg * (1 + rip / 30)
}

export function volumeVoce(v: VoceSessione): number {
  return serieFatte(v).reduce((tot, s) => tot + (s.kg ?? 0) * (s.valore ?? 0), 0)
}

export function volumeSessione(s: Sessione): number {
  return s.voci.reduce((tot, v) => tot + (v.tipo === 'ripetizioni' ? volumeVoce(v) : 0), 0)
}

export function contaSerie(s: Sessione): { fatte: number; complete: number } {
  let fatte = 0
  let complete = 0
  for (const v of s.voci) {
    for (const x of serieFatte(v)) {
      fatte++
      if (x.esito === 'si') complete++
    }
    if (v.cardio && v.cardio.esito !== null) {
      fatte++
      if (v.cardio.esito === 'si') complete++
    }
  }
  return { fatte, complete }
}

/** Prestazioni passate di un esercizio, dalla più recente; solo allenamenti conclusi */
export function storicoEsercizio(sessioni: Sessione[], esercizioId: string, escludiSessione?: string): Prestazione[] {
  const risultato: Prestazione[] = []
  for (const s of sessioni) {
    if (!s.fine || s.id === escludiSessione) continue
    const voce = s.voci.find((v) => v.esercizioId === esercizioId && (serieFatte(v).length > 0 || (v.cardio && v.cardio.esito !== null)))
    if (voce) risultato.push({ sessione: s, voce })
  }
  return risultato.sort((a, b) => b.sessione.inizio - a.sessione.inizio)
}

export interface PuntoForza {
  data: number
  maxKg: number
  massimale: number
  volume: number
  ripetizioni: number
}

export interface PuntoCardio {
  data: number
  durataMin?: number
  distanzaKm?: number
  /** minuti al km */
  passo?: number
}

export interface PuntoTempo {
  data: number
  maxSecondi: number
  totaleSecondi: number
}

export function puntiForza(storico: Prestazione[]): PuntoForza[] {
  return storico
    .map(({ sessione, voce }) => {
      const fatte = serieFatte(voce)
      return {
        data: sessione.inizio,
        maxKg: Math.max(0, ...fatte.map((s) => s.kg ?? 0)),
        massimale: Math.max(0, ...fatte.map((s) => massimaleStimato(s.kg ?? 0, s.valore ?? 0))),
        volume: volumeVoce(voce),
        ripetizioni: fatte.reduce((t, s) => t + (s.valore ?? 0), 0),
      }
    })
    .sort((a, b) => a.data - b.data)
}

export function puntiCardio(storico: Prestazione[]): PuntoCardio[] {
  return storico
    .filter(({ voce }) => voce.cardio)
    .map(({ sessione, voce }) => {
      const c = voce.cardio!
      return {
        data: sessione.inizio,
        durataMin: c.durataMin,
        distanzaKm: c.distanzaKm,
        passo: c.durataMin && c.distanzaKm ? c.durataMin / c.distanzaKm : undefined,
      }
    })
    .sort((a, b) => a.data - b.data)
}

export function puntiTempo(storico: Prestazione[]): PuntoTempo[] {
  return storico
    .map(({ sessione, voce }) => {
      const fatte = serieFatte(voce)
      return {
        data: sessione.inizio,
        maxSecondi: Math.max(0, ...fatte.map((s) => s.valore ?? 0)),
        totaleSecondi: fatte.reduce((t, s) => t + (s.valore ?? 0), 0),
      }
    })
    .sort((a, b) => a.data - b.data)
}

/** Miglior carico, massimale stimato e volume (forza) */
export function recordForza(storico: Prestazione[]) {
  let maxKg: { kg: number; rip: number; data: number } | undefined
  let massimale: { valore: number; data: number } | undefined
  let volume: { valore: number; data: number } | undefined
  for (const { sessione, voce } of storico) {
    for (const s of serieFatte(voce)) {
      const k = s.kg ?? 0
      const r = s.valore ?? 0
      if (k > 0 && (!maxKg || k > maxKg.kg || (k === maxKg.kg && r > maxKg.rip))) maxKg = { kg: k, rip: r, data: sessione.inizio }
      const m = massimaleStimato(k, r)
      if (m > 0 && (!massimale || m > massimale.valore)) massimale = { valore: m, data: sessione.inizio }
    }
    const v = volumeVoce(voce)
    if (v > 0 && (!volume || v > volume.valore)) volume = { valore: v, data: sessione.inizio }
  }
  return { maxKg, massimale, volume }
}

/** Record battuti in una sessione rispetto a tutte le precedenti */
export function recordBattuti(sessione: Sessione, sessioni: Sessione[], nomi: Map<string, string>): string[] {
  const precedenti = sessioni.filter((s) => s.fine && s.inizio < sessione.inizio)
  const messaggi: string[] = []
  for (const voce of sessione.voci) {
    if (voce.tipo !== 'ripetizioni') continue
    const fatte = serieFatte(voce)
    if (!fatte.length) continue
    const prima = recordForza(storicoEsercizio(precedenti, voce.esercizioId))
    if (!prima.maxKg) continue
    const nome = nomi.get(voce.esercizioId) ?? 'Esercizio'
    const maxOra = Math.max(...fatte.map((s) => s.kg ?? 0))
    const massOra = Math.max(...fatte.map((s) => massimaleStimato(s.kg ?? 0, s.valore ?? 0)))
    if (maxOra > prima.maxKg.kg) messaggi.push(`${nome}: nuovo carico massimo`)
    else if (prima.massimale && massOra > prima.massimale.valore + 0.01) messaggi.push(`${nome}: nuovo massimale stimato`)
  }
  return messaggi
}

/** Lunedì 00:00 della settimana di una data */
export function inizioSettimana(d: Date | number): number {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  const giorno = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - giorno)
  return x.getTime()
}

export function sessioniSettimana(sessioni: Sessione[], riferimento: Date | number = Date.now()): number {
  const inizio = inizioSettimana(riferimento)
  const fine = inizio + 7 * 86400000
  return sessioni.filter((s) => s.fine && s.inizio >= inizio && s.inizio < fine).length
}

/** Settimane consecutive con almeno un allenamento (la settimana in corso non interrompe la serie) */
export function settimaneDiFila(sessioni: Sessione[], adesso = Date.now()): number {
  const settimane = new Set(sessioni.filter((s) => s.fine).map((s) => inizioSettimana(s.inizio)))
  let cursore = inizioSettimana(adesso)
  if (!settimane.has(cursore)) cursore = inizioSettimana(cursore - 86400000)
  let conteggio = 0
  while (settimane.has(cursore)) {
    conteggio++
    cursore = inizioSettimana(cursore - 86400000)
  }
  return conteggio
}

/** Ripetizioni (o secondi) previste per la serie i */
export function obiettivoSerie(o: Obiettivo, i: number, tipo: TipoEsercizio): number | undefined {
  if (tipo === 'tempo') return o.secondi
  if (o.repPerSerie?.length) return o.repPerSerie[Math.min(i, o.repPerSerie.length - 1)]
  return o.repMin
}

export interface Suggerimento {
  tipo: 'aumenta' | 'mantieni'
  kg?: number
  testo: string
}

/**
 * Suggerisce il carico in base all'esito delle ultime sessioni:
 * - tutte le serie con tutte le ripetizioni (e, se c'è un range, al massimo del range) → aumenta
 * - altrimenti → mantieni il carico
 */
export function suggerisci(storico: Prestazione[], obiettivo: Obiettivo, incremento: number, sessioniRichieste: number): Suggerimento | undefined {
  if (!storico.length) return undefined
  const range = obiettivo.repMax !== undefined && obiettivo.repMin !== undefined && obiettivo.repMax > obiettivo.repMin && !obiettivo.repPerSerie
  const serieAttese = obiettivo.serie || 1

  const completa = (v: VoceSessione) => {
    const fatte = serieFatte(v)
    return fatte.length >= serieAttese && fatte.every((s) => s.esito === 'si')
  }
  const alMassimo = (v: VoceSessione) => !range || serieFatte(v).every((s) => (s.valore ?? 0) >= obiettivo.repMax!)
  const caricoDi = (v: VoceSessione) => Math.max(0, ...serieFatte(v).map((s) => s.kg ?? 0))

  const ultima = storico[0].voce
  const kgUltimo = caricoDi(ultima)
  const consecutive = storico.slice(0, sessioniRichieste)
  const pronte =
    consecutive.length >= sessioniRichieste && consecutive.every(({ voce }) => completa(voce) && alMassimo(voce) && caricoDi(voce) >= kgUltimo)

  if (pronte) {
    if (kgUltimo > 0) {
      const kg = Math.round((kgUltimo + incremento) * 100) / 100
      return { tipo: 'aumenta', kg, testo: `Hai chiuso tutte le serie: prova ${kg.toLocaleString('it-IT')} kg` }
    }
    return { tipo: 'aumenta', testo: 'Hai chiuso tutte le serie: aggiungi ripetizioni o carico' }
  }
  if (completa(ultima) && !alMassimo(ultima)) {
    return { tipo: 'mantieni', kg: kgUltimo || undefined, testo: `Stesso carico: punta a ${obiettivo.repMax} ripetizioni in ogni serie` }
  }
  if (completa(ultima)) {
    const mancano = sessioniRichieste - consecutive.filter(({ voce }) => completa(voce)).length
    return { tipo: 'mantieni', kg: kgUltimo || undefined, testo: `Ancora ${mancano} ${mancano === 1 ? 'sessione' : 'sessioni'} così e poi aumenta` }
  }
  return { tipo: 'mantieni', kg: kgUltimo || undefined, testo: "L'ultima volta non hai chiuso tutte le serie: stesso carico" }
}
