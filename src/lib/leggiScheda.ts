import type { Obiettivo, TipoEsercizio } from '../db'
import { maiuscolaIniziale } from './formato'

/**
 * Trasforma il testo di una scheda (scritto a mano, copiato da un PDF o da una foto
 * con "Testo live" dell'iPhone) in giorni ed esercizi.
 *
 * Esempi di righe riconosciute:
 *   Panca piana 4x8 rec 90"          Lat machine 4 x 10-12 1'30"
 *   Croci 3 serie da 12              Panca inclinata 4x10/8/6/6
 *   Plank 3x30"                      Tapis roulant 20 min incl. 10%
 *   Squat 5x5 @ 80 kg                Panca 4x8 + croci 3x12 (superserie)
 */

export interface EsercizioLetto extends Obiettivo {
  nome: string
  tipo: TipoEsercizio
  gruppo?: string
  riga: string
  /** non ho trovato serie/ripetizioni: va controllato */
  incerto?: boolean
}

export interface GiornoLetto {
  nome: string
  esercizi: EsercizioLetto[]
}

export interface SchedaLetta {
  titolo?: string
  giorni: GiornoLetto[]
  ignorate: string[]
}

const RIPETIZIONI = String.raw`(max|cedimento|amrap|\d{1,3}(?:\s*[-/]\s*\d{1,3})*)`
const UNITA = String.raw`('|"|sec(?:ondi)?\b|s\b|min(?:uti)?\b|rip(?:etizioni)?\b|reps?\b)`

const RE_SERIE_X = new RegExp(String.raw`(\d{1,2})\s*x\s*${RIPETIZIONI}\s*${UNITA}?`, 'i')
const RE_SERIE_TESTO = new RegExp(String.raw`(\d{1,2})\s*(?:serie|sets?)\b\s*(?:da|di|x|per)?\s*${RIPETIZIONI}?\s*${UNITA}?`, 'i')
/** formato a colonne (tabelle copiate): "Panca piana   4   8   90"" */
const RE_COLONNE = /^(.*?[a-zà-ÿ].*?)\s+(\d{1,2})\s+(max|\d{1,3}(?:\s*[-/]\s*\d{1,3})*)(?=\s|$)/i

const PAROLA_REC = String.raw`(?:rec(?:upero)?|riposo|pausa|rest|r\.)`
const RE_REC_MIN_SEC = new RegExp(String.raw`(?:^|\s|\()${PAROLA_REC}\s*[:.]?\s*(\d{1,2})\s*(?:'|min\b|m\b)\s*(\d{1,2})(?![\dx.,])\s*(?:"|sec(?:ondi)?\b|s\b)?`, 'i')
const RE_REC = new RegExp(String.raw`(?:^|\s|\()${PAROLA_REC}\s*[:.]?\s*(\d{1,3}(?:[.,]\d)?)\s*(min(?:uti)?\b|m\b|sec(?:ondi)?\b|s\b|'|")?`, 'i')
const RE_REC_DOPO = /(\d{1,3})\s*('|"|min(?:uti)?\b|sec(?:ondi)?\b|s\b)\s*(?:(\d{1,2})\s*"?\s*)?(?:di\s+)?(?:rec(?:upero)?|riposo|pausa)\b/i
const RE_TEMPO_NUDO = /(\d{1,3})\s*('|"|sec(?:ondi)?\b|min(?:uti)?\b)(?:\s*(\d{1,2})(?![\dx.,])\s*"?)?/i

const RE_KG = /(?:@\s*)?(\d{1,3}(?:[.,]\d{1,2})?)\s*kg\b/i
const RE_CHIOCCIOLA = /@\s*(\d{1,3}(?:[.,]\d{1,2})?)/
const RE_KM = /(\d{1,3}(?:[.,]\d{1,2})?)\s*km\b(?!\s*\/\s*h)/i
const RE_METRI = /(\d{3,5})\s*(?:m|mt|metri)\b/i
const RE_DURATA = /(\d{1,3})\s*(?:min(?:uti)?\b|')(?:\s*(\d{1,2})\s*")?/i
const RE_ORE = /(\d(?:[.,]\d)?)\s*(?:h|ore|ora)\b/i

const RE_CARDIO =
  /\b(tapis|treadmill|corsa|correre|camminata|cyclette|cyclet|bike|bici|spinning|ellittica|elliptical|vogatore|rower|stepper|stair|nuoto|air ?bike|assault|salto (?:della |con la )?corda|skierg|crosstrainer|cross trainer|hiit)\b/i
const RE_ISOMETRICO = /\b(plank|isometric|wall ?sit|hollow|l-?sit|dead ?hang|sedia al muro|ponte)\b/i

const GIORNI_SETTIMANA = 'luned[iì]|marted[iì]|mercoled[iì]|gioved[iì]|venerd[iì]|sabato|domenica'
const RE_INTESTAZIONE = new RegExp(String.raw`^(?:giorno|day|allenamento|seduta|sessione|workout|training|${GIORNI_SETTIMANA})(?![a-zà-ÿ])`, 'i')
const RE_SCHEDA_GIORNO = /^scheda\s+(?:[A-F]|\d{1,2})\b/i
const RE_LETTERA = /^[A-F]\s*(?:[:).\-–—]|$)/
const RE_SOLO_RECUPERO = /^(?:rec(?:upero)?|riposo|pausa)\b/i

const RE_PUNTO_ELENCO = /^(?:[-–—•*·▪►>✓✔]+\s*|\d{1,2}\s*[.)]\s+|\d{1,2}[.)](?=[a-zà-ÿ])|[a-z]\)\s*)/i

function normalizzaRiga(r: string): string {
  return r
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '')
    .replace(/\|/g, ' ')
    .replace(/(\d)\s*\*\s*(\d)/g, '$1x$2')
    .replace(/[*_]+/g, '')
    .replace(/^\s*#+\s*/, '')
    .replace(/[‘’′´`]/g, "'")
    .replace(/[“”″«»]/g, '"')
    .replace(/''/g, '"')
    .replace(/[×✕✖]/g, 'x')
    .replace(/\s+/g, ' ')
    .trim()
}

function pulisci(s: string): string {
  return s
    .replace(/\(\s*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-–—:,;.|/+)]+|[\s\-–—:,;.|/+(]+$/g, '')
    .trim()
}

function num(s: string | undefined): number | undefined {
  if (s === undefined) return undefined
  const n = Number(s.replace(',', '.'))
  return Number.isFinite(n) ? n : undefined
}

function tuttoMaiuscolo(t: string): boolean {
  const lettere = t.replace(/[^a-zà-ÿ]/gi, '')
  return lettere.length >= 3 && lettere === lettere.toUpperCase()
}

function haSerie(t: string): boolean {
  return RE_SERIE_X.test(t) || /\d{1,2}\s*(?:serie|sets?)\b/i.test(t)
}

function haDati(t: string): boolean {
  return haSerie(t) || RE_DURATA.test(t) || RE_KM.test(t) || RE_METRI.test(t) || RE_CARDIO.test(t)
}

/** secondi da "1'30"", "90"", "2 min", "2" (senza unità: ≤10 = minuti) */
function secondiDa(valore: string, unita?: string, secondiExtra?: string): number | undefined {
  const v = num(valore)
  if (v === undefined) return undefined
  const u = (unita ?? '').toLowerCase()
  let s: number
  if (u === "'" || u.startsWith('m')) s = v * 60
  else if (u === '"' || u.startsWith('s')) s = v
  else s = v <= 10 ? v * 60 : v
  if (secondiExtra) s += Number(secondiExtra)
  return Math.round(s)
}

function leggiRipetizioni(v: string, serie: number): Pick<Obiettivo, 'repMin' | 'repMax' | 'repPerSerie'> & { cedimento?: boolean } {
  if (/max|cedimento|amrap/i.test(v)) return { cedimento: true }
  const numeri = v.split(/\s*[-/]\s*/).map(Number).filter((n) => Number.isFinite(n) && n > 0)
  if (numeri.length === 0) return {}
  if (numeri.length === 1) return { repMin: numeri[0], repMax: numeri[0] }
  const min = Math.min(...numeri)
  const max = Math.max(...numeri)
  const piramide = numeri.length >= 3 || (v.includes('/') && serie === 2)
  if (!piramide) return { repMin: min, repMax: max }
  const perSerie = Array.from({ length: Math.max(serie, numeri.length) }, (_, i) => numeri[Math.min(i, numeri.length - 1)])
  return { repMin: min, repMax: max, repPerSerie: perSerie }
}

/** Legge una singola riga esercizio (può contenerne due se scritte come superserie "A + B") */
export function leggiRigaEsercizio(rigaGrezza: string): EsercizioLetto[] {
  const riga = normalizzaRiga(rigaGrezza).replace(RE_PUNTO_ELENCO, '')
  const parti = riga.split(/\s\+\s/)
  if (parti.length > 1 && parti.every((p) => haSerie(p))) {
    return parti.map((p) => {
      const e = leggiParte(p, rigaGrezza)
      e.note = e.note ? `Superserie · ${e.note}` : 'Superserie'
      return e
    })
  }
  return [leggiParte(riga, rigaGrezza)]
}

function leggiParte(testo: string, rigaOriginale: string): EsercizioLetto {
  let resto = testo
  const inizi: number[] = []
  const togli = (m: RegExpExecArray | null): RegExpExecArray | null => {
    if (!m) return null
    inizi.push(m.index)
    resto = resto.slice(0, m.index) + ' '.repeat(m[0].length) + resto.slice(m.index + m[0].length)
    return m
  }

  const o: Obiettivo = { serie: 0 }
  let cedimento = false

  // 1. recupero esplicito
  let m = togli(RE_REC_MIN_SEC.exec(resto))
  if (m) o.recuperoSec = Number(m[1]) * 60 + Number(m[2])
  else if ((m = togli(RE_REC.exec(resto)))) o.recuperoSec = secondiDa(m[1], m[2])
  else if ((m = togli(RE_REC_DOPO.exec(resto)))) o.recuperoSec = secondiDa(m[1], m[2], m[3])

  // 2. serie × ripetizioni
  let tipo: TipoEsercizio = 'ripetizioni'
  let trovateSerie = false
  m = togli(RE_SERIE_X.exec(resto)) ?? togli(RE_SERIE_TESTO.exec(resto))
  if (m) {
    trovateSerie = true
    o.serie = Number(m[1])
    const valore = m[2]
    const unita = (m[3] ?? '').toLowerCase()
    const aTempo = unita === '"' || unita === "'" || unita.startsWith('s') || unita.startsWith('min')
    if (valore && aTempo) {
      tipo = 'tempo'
      o.secondi = secondiDa(valore, unita)
    } else if (valore) {
      const rip = leggiRipetizioni(valore, o.serie)
      if (rip.cedimento) cedimento = true
      else if (RE_ISOMETRICO.test(testo) && (rip.repMax ?? 0) >= 15 && !unita.startsWith('r')) {
        tipo = 'tempo'
        o.secondi = rip.repMax
      } else Object.assign(o, { repMin: rip.repMin, repMax: rip.repMax, repPerSerie: rip.repPerSerie })
    }
  }

  // 3. carico
  m = togli(RE_KG.exec(resto)) ?? togli(RE_CHIOCCIOLA.exec(resto))
  if (m) o.caricoKg = num(m[1])

  // 4. cardio
  const nomeCardio = RE_CARDIO.test(testo)
  if (!trovateSerie) {
    if ((m = togli(RE_KM.exec(resto)))) o.distanzaKm = num(m[1])
    else if ((m = togli(RE_METRI.exec(resto)))) o.distanzaKm = Number(m[1]) / 1000
    if ((m = togli(RE_DURATA.exec(resto)))) o.durataMin = Number(m[1]) + (m[2] ? Number(m[2]) / 60 : 0)
    else if ((m = togli(RE_ORE.exec(resto)))) o.durataMin = Math.round((num(m[1]) ?? 0) * 60)
    if (nomeCardio || o.durataMin !== undefined || o.distanzaKm !== undefined) {
      tipo = 'cardio'
      o.serie = 1
    }
  }

  // 5. tabella a colonne: "Panca piana 4 8 90""
  if (!trovateSerie && tipo !== 'cardio') {
    const c = RE_COLONNE.exec(resto)
    if (c) {
      trovateSerie = true
      o.serie = Number(c[2])
      const rip = leggiRipetizioni(c[3], o.serie)
      if (rip.cedimento) cedimento = true
      else Object.assign(o, { repMin: rip.repMin, repMax: rip.repMax, repPerSerie: rip.repPerSerie })
      const inizio = c.index + c[1].length
      inizi.push(inizio)
      resto = resto.slice(0, inizio) + ' '.repeat(c[0].length - c[1].length) + resto.slice(c.index + c[0].length)
    }
  }

  // 6. un tempo "nudo" dopo serie×rip è il recupero ("Panca 4x8 1'30"")
  if (trovateSerie && o.recuperoSec === undefined) {
    m = togli(RE_TEMPO_NUDO.exec(resto))
    if (m) o.recuperoSec = secondiDa(m[1], m[2], m[3])
  }

  // nome = testo prima del primo dato riconosciuto; il resto diventa nota
  const primo = inizi.length ? Math.min(...inizi) : resto.length
  let nome = pulisci(resto.slice(0, primo))
  let note = pulisci(resto.slice(primo))
  if (!nome) {
    nome = note
    note = ''
  }
  const parentesi = /\(([^)]*)\)/.exec(nome)
  if (parentesi) {
    nome = pulisci(nome.replace(parentesi[0], ' '))
    note = pulisci([parentesi[1], note].filter(Boolean).join(' · '))
  }
  const noteFinali = [cedimento ? 'A cedimento' : '', note.length >= 2 && /[a-zà-ÿ0-9]/i.test(note) ? note : '']
    .filter(Boolean)
    .join(' · ')

  const incerto = tipo === 'ripetizioni' && !trovateSerie
  if (incerto) o.serie = 3
  if (tipo === 'tempo' && !o.serie) o.serie = 3

  return {
    ...o,
    nome: maiuscolaIniziale(nome || 'Esercizio'),
    tipo,
    note: noteFinali || undefined,
    riga: rigaOriginale.trim(),
    incerto: incerto || undefined,
  }
}

interface InfoRiga {
  t: string
  vuota: boolean
  dati: boolean
  forte: boolean
  titoloScheda: boolean
  debole: boolean
  soloRecupero: boolean
  /** riga d'intestazione di una tabella ("Esercizio | Serie × Rip"): si ignora */
  tabella: boolean
}

const RE_ORDINALE = /^(?:\d{1,2}\s*[°ºª^]?|prim[oa]|second[oa]|terz[oa]|quart[oa]|quint[oa]|sest[oa]|settim[oa])\s*(?:giorno|allenamento|seduta|day)(?![a-zà-ÿ])/i
const RE_TABELLA = /^(?:(?:esercizi[oa]?|serie|sets?|rip(?:etizioni)?|reps?|recupero|rec|carico|kg|peso|note|tempo|pausa|durata|x)(?![a-zà-ÿ])[\s|/x\-–:.()]*)+$/i

/** La riga senza simboli iniziali/finali (emoji, markdown, punti elenco): "**Giorno 1**" → "Giorno 1" */
function nucleo(t: string): string {
  return t.replace(/^[^\p{L}\p{N}]+/u, '').replace(/[\s*_#=~]+$/u, '')
}

function classifica(t: string): InfoRiga {
  const vuota = !/[\p{L}\p{N}]/u.test(t)
  const n = nucleo(t)
  const senzaPunto = t.replace(RE_PUNTO_ELENCO, '')
  const conSerie = haSerie(senzaPunto)
  const tabella = !vuota && RE_TABELLA.test(n)
  // "Giorno 1: Push (20 serie)" è un giorno: conta solo un vero "4x8" per farne un esercizio
  const parolaGiorno = (RE_INTESTAZIONE.test(n) || RE_SCHEDA_GIORNO.test(n) || RE_ORDINALE.test(n)) && !RE_SERIE_X.test(n)
  const titoloScheda = !vuota && !conSerie && /^scheda\b/i.test(n) && !RE_SCHEDA_GIORNO.test(n)
  const forte = !vuota && !tabella && !titoloScheda && (parolaGiorno || (!conSerie && RE_LETTERA.test(n) && !haDati(n)))
  const soloRecupero = !vuota && !conSerie && RE_SOLO_RECUPERO.test(senzaPunto) && (RE_REC.test(senzaPunto) || RE_REC_MIN_SEC.test(senzaPunto))
  // frase descrittiva ("Gli affondi valgono 4 serie perché…"): è una nota, non un esercizio
  const parole = n.split(/\s+/).length
  const frase = !RE_SERIE_X.test(n) && (parole >= 12 || (parole >= 8 && /[.!?]\s*$/.test(n)))
  const dati = !vuota && !tabella && !forte && !titoloScheda && !soloRecupero && !frase && haDati(senzaPunto)
  const debole = !vuota && !tabella && !dati && !forte && !titoloScheda && !soloRecupero && (/:\s*$/.test(t) || tuttoMaiuscolo(n))
  return { t, vuota, dati, forte, titoloScheda, debole, soloRecupero, tabella }
}

/** "Giorno A" → "Giorno 1", "B) Dorso" → "Giorno 2 - Dorso" */
function numeraGiorno(nome: string): string {
  const conParola = /^((?:giorno|day|allenamento|seduta|sessione|workout|training)\s+)([A-H])(?![\p{L}\p{N}])/iu.exec(nome)
  if (conParola) return nome.replace(conParola[0], conParola[1] + (conParola[2].toUpperCase().charCodeAt(0) - 64))
  const lettera = /^([A-H])\s*(?:[:).\-–—]\s*|$)(.*)$/.exec(nome)
  if (lettera) return `Giorno ${lettera[1].charCodeAt(0) - 64}${lettera[2] ? ` - ${lettera[2]}` : ''}`
  return nome
}

function nomeDaIntestazione(t: string): string {
  const grezzo = pulisci(
    nucleo(t)
      .replace(/:\s*$/, '')
      // "(20 serie)", "(~60 min)" alla fine non fanno parte del nome
      .replace(/\s*\([^)]*\d[^)]*\)\s*$/, ''),
  )
  let nome = maiuscolaIniziale(grezzo)
  // "GIORNO A - PETTO" → "Giorno A - Petto" (non "Giorno a - petto")
  nome = nome.replace(/^((?:giorno|scheda|day|allenamento|seduta|sessione|workout|training)\s+)([a-z])\b/i, (_, p, l: string) => p + l.toUpperCase())
  if (tuttoMaiuscolo(grezzo)) nome = nome.replace(/(\s[-–—:]\s*)([a-zà-ÿ])/g, (_, p, l: string) => p + l.toUpperCase())
  return numeraGiorno(nome)
}

function recuperoDaRiga(t: string): number | undefined {
  const m = RE_REC_MIN_SEC.exec(t)
  if (m) return Number(m[1]) * 60 + Number(m[2])
  const r = RE_REC.exec(t)
  return r ? secondiDa(r[1], r[2]) : undefined
}

export function leggiScheda(testo: string): SchedaLetta {
  const info = testo
    .split(/\r\n|\r|\n|\u2028|\u2029/)
    .map((r) => classifica(normalizzaRiga(r)))
    .filter((r) => !r.tabella)

  let titolo: string | undefined
  const giorni: (GiornoLetto & { recupero?: number })[] = []
  const ignorate: string[] = []
  let corrente: (GiornoLetto & { recupero?: number }) | null = null
  let gruppo: string | undefined
  let recuperoGenerale: number | undefined

  const nuovoGiorno = (nome: string) => {
    corrente = { nome, esercizi: [] }
    giorni.push(corrente)
    gruppo = undefined
  }
  const aggiungi = (t: string) => {
    if (!corrente) nuovoGiorno('')
    for (const e of leggiRigaEsercizio(t)) {
      if (gruppo) e.gruppo = gruppo
      corrente!.esercizi.push(e)
    }
  }
  /** riga che non è né un giorno né un esercizio riconosciuto */
  const rigaGenerica = (r: InfoRiga, comeGruppo: boolean) => {
    if (r.soloRecupero) {
      const s = recuperoDaRiga(r.t)
      if (corrente) corrente.recupero = s
      else recuperoGenerale = s
    } else if (r.titoloScheda) {
      titolo ??= nomeDaIntestazione(r.t)
    } else if (!corrente && giorni.length === 0 && !titolo) {
      titolo = nomeDaIntestazione(r.t)
    } else if (r.debole && comeGruppo) {
      gruppo = nomeDaIntestazione(r.t)
    } else if (r.t.length > 50) {
      ignorate.push(r.t)
    } else {
      aggiungi(r.t)
    }
  }

  const blocchi: InfoRiga[][] = []
  let blocco: InfoRiga[] = []
  for (const r of info) {
    if (r.vuota) {
      if (blocco.length) blocchi.push(blocco)
      blocco = []
    } else blocco.push(r)
  }
  if (blocco.length) blocchi.push(blocco)

  const piene = info.filter((r) => !r.vuota)
  const ciSonoForti = piene.some((r) => r.forte)
  const blocchiConNome = blocchi.filter((b) => b.length > 1 && !b[0].dati && !b[0].soloRecupero).length
  // righe brevi senza dati seguite da esercizi ("Petto e tricipiti" ↵ "Panca 4x8"): probabilmente giorni
  const titoliSemplici = new Set(
    piene.filter((r, i) => !r.dati && !r.soloRecupero && !r.titoloScheda && r.t.length <= 40 && piene[i + 1]?.dati),
  )
  const blocchiDiEsercizi = blocchi.filter((b) => b.filter((r) => r.dati).length >= 2).length

  if (ciSonoForti) {
    for (const r of piene) {
      if (r.forte) nuovoGiorno(nomeDaIntestazione(r.t))
      else if (r.dati) aggiungi(r.t)
      else rigaGenerica(r, true)
    }
  } else if (blocchi.length > 1 && blocchiConNome >= 2) {
    blocchi.forEach((b, i) => {
      if (i === 0 && b.length === 1 && !b[0].dati) {
        titolo ??= nomeDaIntestazione(b[0].t)
        return
      }
      const [primo, ...altri] = b
      if (!primo.dati && !primo.soloRecupero && !primo.titoloScheda) nuovoGiorno(nomeDaIntestazione(primo.t))
      else {
        nuovoGiorno('')
        if (primo.titoloScheda) titolo ??= nomeDaIntestazione(primo.t)
        else if (primo.dati) aggiungi(primo.t)
        else rigaGenerica(primo, true)
      }
      for (const r of altri) {
        if (r.dati) aggiungi(r.t)
        else rigaGenerica(r, true)
      }
    })
  } else if (piene.some((r) => r.debole)) {
    for (const r of piene) {
      if (r.dati) aggiungi(r.t)
      else if (r.debole) nuovoGiorno(nomeDaIntestazione(r.t))
      else rigaGenerica(r, false)
    }
  } else if (titoliSemplici.size >= 2) {
    for (const r of piene) {
      if (r.dati) aggiungi(r.t)
      else if (titoliSemplici.has(r)) nuovoGiorno(nomeDaIntestazione(r.t))
      else rigaGenerica(r, false)
    }
  } else if (blocchiDiEsercizi >= 2) {
    // blocchi di esercizi separati da righe vuote, senza titolo: un giorno per blocco
    for (const b of blocchi) {
      if (b.some((r) => r.dati)) nuovoGiorno('')
      for (const r of b) {
        if (r.dati) aggiungi(r.t)
        else rigaGenerica(r, false)
      }
    }
  } else {
    for (const r of piene) {
      if (r.dati) aggiungi(r.t)
      else rigaGenerica(r, false)
    }
  }

  const risultato = giorni.filter((g) => g.esercizi.length > 0)
  risultato.forEach((g, i) => {
    if (!g.nome) g.nome = `Giorno ${i + 1}`
    const rec = g.recupero ?? recuperoGenerale
    if (rec !== undefined) {
      for (const e of g.esercizi) if (e.tipo !== 'cardio' && e.recuperoSec === undefined) e.recuperoSec = rec
    }
  })

  return {
    titolo,
    giorni: risultato.map(({ nome, esercizi }) => ({ nome, esercizi })),
    ignorate,
  }
}
