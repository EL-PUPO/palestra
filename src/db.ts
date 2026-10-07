import Dexie, { type EntityTable } from 'dexie'

/** ripetizioni = serie × ripetizioni; tempo = serie a tempo (es. plank); cardio = durata/distanza */
export type TipoEsercizio = 'ripetizioni' | 'tempo' | 'cardio'

export interface Esercizio {
  id: string
  nome: string
  tipo: TipoEsercizio
  gruppo?: string
  note?: string
  /** incremento di carico suggerito per questo esercizio (se assente, quello delle impostazioni) */
  incrementoKg?: number
  creatoIl: number
}

/** Cosa prevede la scheda per un esercizio */
export interface Obiettivo {
  serie: number
  repMin?: number
  repMax?: number
  /** piramidale, es. 10/8/6 */
  repPerSerie?: number[]
  /** per gli esercizi a tempo */
  secondi?: number
  recuperoSec?: number
  caricoKg?: number
  durataMin?: number
  distanzaKm?: number
  note?: string
  /** prova di massimale: 1–3 colpi al carico più alto */
  massimale?: boolean
}

export interface EsercizioScheda extends Obiettivo {
  uid: string
  esercizioId: string
}

export interface GiornoScheda {
  uid: string
  nome: string
  esercizi: EsercizioScheda[]
}

export interface Scheda {
  id: string
  nome: string
  giorni: GiornoScheda[]
  attiva: boolean
  creataIl: number
  archiviataIl?: number
  testoOriginale?: string
}

/** 'si' = fatte almeno le ripetizioni previste, 'no' = meno del previsto, null = serie non ancora fatta */
export type Esito = 'si' | 'no' | null

export interface SerieRegistrata {
  /** ripetizioni (o secondi) previste */
  obiettivo?: number
  kg?: number
  /** ripetizioni (o secondi) fatte */
  valore?: number
  esito: Esito
  /** serie di massimale (1–3 colpi): non conta come serie "mancata" */
  massimale?: boolean
}

export interface CardioRegistrato {
  durataMin?: number
  distanzaKm?: number
  note?: string
  esito: Esito
}

export interface VoceSessione {
  uid: string
  esercizioId: string
  tipo: TipoEsercizio
  obiettivo: Obiettivo
  serie: SerieRegistrata[]
  cardio?: CardioRegistrato
  note?: string
  /** nel registro: esercizio non fatto, da non salvare */
  saltato?: boolean
}

/** allenamento = guidato dall'app (timer, un esercizio alla volta); registro = solo per segnare i risultati */
export type Modalita = 'allenamento' | 'registro'

export interface Sessione {
  id: string
  /** assente nelle sessioni create prima delle due modalità: valgono come "allenamento" */
  modalita?: Modalita
  schedaId?: string
  giornoUid?: string
  nomeGiorno: string
  inizio: number
  /** assente finché l'allenamento è in corso */
  fine?: number
  voci: VoceSessione[]
  note?: string
  indiceCorrente?: number
  /** registro di un allenamento passato senza durata indicata */
  senzaDurata?: boolean
  /** recupero uguale per tutto l'allenamento (secondi) */
  recuperoSec?: number
}

export interface MisuraCorpo {
  id: string
  /** AAAA-MM-GG */
  data: string
  peso?: number
  vita?: number
  petto?: number
  braccio?: number
  coscia?: number
  fianchi?: number
  grasso?: number
  note?: string
}

export interface FotoProgresso {
  id: string
  data: string
  immagine: Blob
  note?: string
}

/** Un file musicale importato dall'app File (MP3, M4A…) */
export interface Brano {
  id: string
  titolo: string
  artista?: string
  /** secondi */
  durata?: number
  file: Blob
  /** byte */
  dimensione: number
  aggiuntoIl: number
}

export const db = new Dexie('palestra') as Dexie & {
  esercizi: EntityTable<Esercizio, 'id'>
  schede: EntityTable<Scheda, 'id'>
  sessioni: EntityTable<Sessione, 'id'>
  misure: EntityTable<MisuraCorpo, 'id'>
  foto: EntityTable<FotoProgresso, 'id'>
  brani: EntityTable<Brano, 'id'>
}

const TABELLE = {
  esercizi: 'id, nome',
  schede: 'id, creataIl',
  sessioni: 'id, inizio, schedaId',
  misure: 'id, data',
  foto: 'id, data',
}

db.version(1).stores(TABELLE)

// v2: i giorni si chiamano "Giorno 1, 2, 3…" invece di "Giorno A, B, C…"
db.version(2)
  .stores(TABELLE)
  .upgrade(async (tx) => {
    const numera = (nome: string) => nome.replace(/^Giorno ([A-H])(?![\p{L}\p{N}])/u, (_, l: string) => `Giorno ${l.charCodeAt(0) - 64}`)
    await tx
      .table<Scheda>('schede')
      .toCollection()
      .modify((s) => {
        for (const g of s.giorni) g.nome = numera(g.nome)
      })
    await tx
      .table<Sessione>('sessioni')
      .toCollection()
      .modify((s) => {
        s.nomeGiorno = numera(s.nomeGiorno)
      })
  })

// v3: libreria di brani MP3
db.version(3).stores({ ...TABELLE, brani: 'id, aggiuntoIl' })

/** Id univoco che funziona anche fuori da HTTPS (crypto.randomUUID no) */
export function nuovoId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
}
