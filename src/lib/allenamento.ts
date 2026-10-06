import {
  db,
  nuovoId,
  type CardioRegistrato,
  type Esercizio,
  type EsercizioScheda,
  type Esito,
  type GiornoScheda,
  type Modalita,
  type Obiettivo,
  type Scheda,
  type SerieRegistrata,
  type Sessione,
  type TipoEsercizio,
  type VoceSessione,
} from '../db'
import { indovinaGruppo } from './catalogo'
import { normalizzaNome } from './formato'
import { obiettivoSerie, serieFatte, storicoEsercizio, type Prestazione } from './statistiche'

export function obiettivoDi(es: EsercizioScheda): Obiettivo {
  return {
    serie: es.serie,
    repMin: es.repMin,
    repMax: es.repMax,
    repPerSerie: es.repPerSerie,
    secondi: es.secondi,
    recuperoSec: es.recuperoSec,
    caricoKg: es.caricoKg,
    durataMin: es.durataMin,
    distanzaKm: es.distanzaKm,
    note: es.note,
  }
}

/** Prepara un esercizio per l'allenamento: ripetizioni previste dalla scheda, carichi dell'ultima volta */
export function creaVoce(es: Esercizio, obiettivo: Obiettivo, storico: Prestazione[]): VoceSessione {
  const ultima = storico[0]?.voce
  const base = { uid: nuovoId(), esercizioId: es.id, tipo: es.tipo, obiettivo }
  if (es.tipo === 'cardio') {
    return {
      ...base,
      serie: [],
      cardio: {
        durataMin: obiettivo.durataMin ?? ultima?.cardio?.durataMin,
        distanzaKm: obiettivo.distanzaKm ?? ultima?.cardio?.distanzaKm,
        esito: null,
      },
    }
  }
  const precedenti = ultima ? serieFatte(ultima) : []
  const serie = Array.from({ length: obiettivo.serie || 3 }, (_, i) => {
    const target = obiettivoSerie(obiettivo, i, es.tipo)
    const prec = precedenti.length ? precedenti[Math.min(i, precedenti.length - 1)] : undefined
    // si parte da "0" rispetto al previsto: i tasti − e + dicono quante in meno o in più
    return { obiettivo: target, kg: prec?.kg ?? obiettivo.caricoKg, valore: target ?? prec?.valore, esito: null }
  })
  return { ...base, serie }
}

/** Esito di una serie dalle ripetizioni fatte rispetto alle previste */
export function esitoDa(s: SerieRegistrata): Esito {
  if (s.valore === undefined) return null
  return s.obiettivo === undefined || s.valore >= s.obiettivo ? 'si' : 'no'
}

/** Esito del cardio: "no" se durata o distanza sono sotto il previsto */
export function esitoCardio(obiettivo: Obiettivo, c: CardioRegistrato | undefined): Esito {
  if (!c || (c.durataMin === undefined && c.distanzaKm === undefined)) return null
  const sotto = (fatto: number | undefined, previsto: number | undefined) => previsto !== undefined && (fatto ?? 0) < previsto
  return sotto(c.durataMin, obiettivo.durataMin) || sotto(c.distanzaKm, obiettivo.distanzaKm) ? 'no' : 'si'
}

export async function sessioneInCorso(): Promise<Sessione | undefined> {
  return (await db.sessioni.toArray()).find((s) => !s.fine)
}

export async function iniziaSessione(scheda?: Scheda, giorno?: GiornoScheda, modalita: Modalita = 'allenamento'): Promise<string> {
  const inCorso = await sessioneInCorso()
  if (inCorso) return inCorso.id
  const [sessioni, esercizi] = await Promise.all([db.sessioni.toArray(), db.esercizi.toArray()])
  const mappa = new Map(esercizi.map((e) => [e.id, e]))
  const voci: VoceSessione[] = []
  for (const es of giorno?.esercizi ?? []) {
    const e = mappa.get(es.esercizioId)
    if (e) voci.push(creaVoce(e, obiettivoDi(es), storicoEsercizio(sessioni, e.id)))
  }
  const s: Sessione = {
    id: nuovoId(),
    modalita,
    schedaId: scheda?.id,
    giornoUid: giorno?.uid,
    nomeGiorno: giorno?.nome ?? 'Allenamento libero',
    inizio: Date.now(),
    voci,
    indiceCorrente: 0,
  }
  await db.sessioni.add(s)
  return s.id
}

/** Aggiunge un esercizio a un allenamento in corso */
export async function aggiungiVoce(sessione: Sessione, es: Esercizio, recuperoSec: number) {
  const sessioni = await db.sessioni.toArray()
  const storico = storicoEsercizio(sessioni, es.id, sessione.id)
  const precedente = storico[0]?.voce.obiettivo
  const obiettivo: Obiettivo = precedente ?? (es.tipo === 'cardio' ? { serie: 1 } : { serie: 3, recuperoSec })
  const voce = creaVoce(es, obiettivo, storico)
  await db.sessioni.update(sessione.id, { voci: [...sessione.voci, voce], indiceCorrente: sessione.voci.length })
}

/** Chiude l'allenamento scartando le serie mai segnate */
export async function concludiSessione(sessione: Sessione) {
  const voci = sessione.voci
    .map((v) => ({ ...v, serie: v.serie.filter((s) => s.esito !== null) }))
    .filter((v) => v.serie.length > 0 || (v.cardio && v.cardio.esito !== null))
  await db.sessioni.update(sessione.id, { voci, fine: Date.now() })
}

/**
 * Salva un registro: tutte le serie scritte valgono come fatte (l'esito si ricava da − / +),
 * gli esercizi segnati come saltati non vengono salvati.
 */
export async function salvaRegistro(sessione: Sessione, quando: { inizio: number; fine: number; senzaDurata: boolean }) {
  const voci = sessione.voci
    .filter((v) => !v.saltato)
    .map((v) =>
      v.tipo === 'cardio'
        ? { ...v, cardio: v.cardio ? { ...v.cardio, esito: esitoCardio(v.obiettivo, v.cardio) } : undefined }
        : { ...v, serie: v.serie.filter((s) => s.valore !== undefined).map((s) => ({ ...s, esito: esitoDa(s) })) },
    )
    .filter((v) => v.serie.length > 0 || (v.cardio && v.cardio.esito !== null))
  await db.sessioni.update(sessione.id, { voci, inizio: quando.inizio, fine: quando.fine, senzaDurata: quando.senzaDurata || undefined })
}

/** Strada dell'app per una sessione in corso */
export const percorsoSessione = (s: Sessione) => (s.modalita === 'registro' ? '/registro' : '/allenamento')

export function prossimoGiorno(scheda: Scheda, sessioni: Sessione[]): GiornoScheda | undefined {
  const ultima = sessioni
    .filter((s) => s.fine && s.schedaId === scheda.id)
    .sort((a, b) => b.inizio - a.inizio)[0]
  if (!ultima) return scheda.giorni[0]
  const i = scheda.giorni.findIndex((g) => g.uid === ultima.giornoUid)
  return scheda.giorni[(i + 1) % scheda.giorni.length] ?? scheda.giorni[0]
}

/** Cerca un esercizio con lo stesso nome (ignorando maiuscole e accenti), altrimenti lo crea */
export async function trovaOCreaEsercizio(
  nome: string,
  tipo: TipoEsercizio,
  gruppo: string | undefined,
  cache: Map<string, Esercizio>,
): Promise<Esercizio> {
  const chiave = normalizzaNome(nome)
  const esistente = cache.get(chiave)
  gruppo ??= indovinaGruppo(nome)
  if (esistente) {
    if (!esistente.gruppo && gruppo) {
      esistente.gruppo = gruppo
      await db.esercizi.update(esistente.id, { gruppo })
    }
    return esistente
  }
  const nuovo: Esercizio = { id: nuovoId(), nome: nome.trim(), tipo, gruppo, creatoIl: Date.now() }
  await db.esercizi.add(nuovo)
  cache.set(chiave, nuovo)
  return nuovo
}

export async function cacheEsercizi(): Promise<Map<string, Esercizio>> {
  const tutti = await db.esercizi.toArray()
  return new Map(tutti.map((e) => [normalizzaNome(e.nome), e]))
}

/** Esercizio scelto dalla libreria: può essere già tra i tuoi (esercizio) o da creare */
export interface SceltaEsercizio {
  esercizio?: Esercizio
  nome: string
  tipo: TipoEsercizio
  gruppo?: string
}

export async function assicuraEsercizio(s: SceltaEsercizio): Promise<Esercizio> {
  if (s.esercizio) return s.esercizio
  return trovaOCreaEsercizio(s.nome, s.tipo, s.gruppo, await cacheEsercizi())
}

/** Obiettivo di partenza per un esercizio aggiunto a mano */
export function obiettivoIniziale(tipo: TipoEsercizio, recuperoSec: number): Obiettivo {
  if (tipo === 'cardio') return { serie: 1, durataMin: 20 }
  if (tipo === 'tempo') return { serie: 3, secondi: 30, recuperoSec }
  return { serie: 3, repMin: 10, repMax: 10, recuperoSec }
}

export interface EsercizioDaSalvare extends Obiettivo {
  nome: string
  tipo: TipoEsercizio
  gruppo?: string
}

export async function salvaScheda(
  nome: string,
  giorni: { nome: string; esercizi: EsercizioDaSalvare[] }[],
  opzioni: { attiva: boolean; testoOriginale?: string },
): Promise<string> {
  const id = nuovoId()
  await db.transaction('rw', db.esercizi, db.schede, async () => {
    const cache = await cacheEsercizi()
    const giorniScheda: GiornoScheda[] = []
    for (const g of giorni) {
      const esercizi: EsercizioScheda[] = []
      for (const e of g.esercizi) {
        const es = await trovaOCreaEsercizio(e.nome, e.tipo, e.gruppo, cache)
        const { nome: _nome, tipo: _tipo, gruppo: _gruppo, ...obiettivo } = e
        esercizi.push({ ...obiettivo, uid: nuovoId(), esercizioId: es.id })
      }
      giorniScheda.push({ uid: nuovoId(), nome: g.nome, esercizi })
    }
    if (opzioni.attiva) await disattivaSchede()
    await db.schede.add({
      id,
      nome,
      giorni: giorniScheda,
      attiva: opzioni.attiva,
      creataIl: Date.now(),
      testoOriginale: opzioni.testoOriginale,
    })
  })
  return id
}

async function disattivaSchede() {
  const attive = (await db.schede.toArray()).filter((s) => s.attiva)
  for (const s of attive) await db.schede.update(s.id, { attiva: false, archiviataIl: Date.now() })
}

export async function attivaScheda(id: string) {
  await db.transaction('rw', db.schede, async () => {
    await disattivaSchede()
    await db.schede.update(id, { attiva: true, archiviataIl: undefined })
  })
}

/** Toglie dalla libreria gli esercizi che non compaiono più in nessuna scheda né allenamento */
export async function pulisciEserciziInutilizzati() {
  await db.transaction('rw', db.esercizi, db.schede, db.sessioni, async () => {
    const usati = new Set<string>()
    for (const s of await db.schede.toArray()) for (const g of s.giorni) for (const e of g.esercizi) usati.add(e.esercizioId)
    for (const s of await db.sessioni.toArray()) for (const v of s.voci) usati.add(v.esercizioId)
    const daTogliere = (await db.esercizi.toArray()).filter((e) => !usati.has(e.id)).map((e) => e.id)
    await db.esercizi.bulkDelete(daTogliere)
  })
}
