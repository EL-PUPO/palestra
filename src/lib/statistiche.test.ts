import { describe, expect, it } from 'vitest'
import type { Esercizio, Esito, Obiettivo, Sessione } from '../db'
import { creaVoce } from './allenamento'
import { massimaleStimato, settimaneDiFila, storicoEsercizio, suggerisci } from './statistiche'

const GIORNO = 86400000
const OGGI = new Date(2026, 9, 5, 18).getTime() // lunedì

function sessione(giorniFa: number, serie: [number, number, Esito][], obiettivo: Obiettivo = { serie: 3, repMin: 8, repMax: 8 }): Sessione {
  const inizio = OGGI - giorniFa * GIORNO
  return {
    id: `s${giorniFa}`,
    nomeGiorno: 'A',
    inizio,
    fine: inizio + 3600000,
    voci: [{ uid: 'v', esercizioId: 'panca', tipo: 'ripetizioni', obiettivo, serie: serie.map(([kg, valore, esito]) => ({ kg, valore, esito, obiettivo: obiettivo.repMin })) }],
  }
}

describe('suggerimento di carico', () => {
  const ob: Obiettivo = { serie: 3, repMin: 8, repMax: 8 }

  it('tutte le serie complete → aumenta', () => {
    const st = storicoEsercizio([sessione(3, [[60, 8, 'si'], [60, 8, 'si'], [60, 8, 'si']])], 'panca')
    expect(suggerisci(st, ob, 2.5, 1)).toMatchObject({ tipo: 'aumenta', kg: 62.5 })
  })

  it('una serie non completa → stesso carico', () => {
    const st = storicoEsercizio([sessione(3, [[60, 8, 'si'], [60, 8, 'si'], [60, 6, 'no']])], 'panca')
    expect(suggerisci(st, ob, 2.5, 1)).toMatchObject({ tipo: 'mantieni', kg: 60 })
  })

  it('con un intervallo 8-10 aumenta solo arrivato a 10', () => {
    const range: Obiettivo = { serie: 3, repMin: 8, repMax: 10 }
    const a = storicoEsercizio([sessione(3, [[60, 9, 'si'], [60, 8, 'si'], [60, 8, 'si']], range)], 'panca')
    expect(suggerisci(a, range, 2.5, 1)).toMatchObject({ tipo: 'mantieni' })
    const b = storicoEsercizio([sessione(3, [[60, 10, 'si'], [60, 10, 'si'], [60, 10, 'si']], range)], 'panca')
    expect(suggerisci(b, range, 2.5, 1)).toMatchObject({ tipo: 'aumenta', kg: 62.5 })
  })

  it('richiede più sessioni di fila se impostato', () => {
    const ok: [number, number, Esito][] = [[60, 8, 'si'], [60, 8, 'si'], [60, 8, 'si']]
    const una = storicoEsercizio([sessione(3, ok)], 'panca')
    expect(suggerisci(una, ob, 2.5, 2)).toMatchObject({ tipo: 'mantieni' })
    const due = storicoEsercizio([sessione(3, ok), sessione(10, ok)], 'panca')
    expect(suggerisci(due, ob, 2.5, 2)).toMatchObject({ tipo: 'aumenta', kg: 62.5 })
  })

  it('senza storico nessun suggerimento', () => {
    expect(suggerisci([], ob, 2.5, 1)).toBeUndefined()
  })
})

describe('precompilazione', () => {
  const panca: Esercizio = { id: 'panca', nome: 'Panca', tipo: 'ripetizioni', creatoIl: 0 }

  it("usa i carichi dell'ultima volta", () => {
    const st = storicoEsercizio([sessione(3, [[60, 8, 'si'], [62.5, 8, 'si'], [62.5, 7, 'no']])], 'panca')
    const v = creaVoce(panca, { serie: 4, repMin: 8, repMax: 8 }, st)
    expect(v.serie.map((s) => s.kg)).toEqual([60, 62.5, 62.5, 62.5])
    expect(v.serie.every((s) => s.valore === 8 && s.esito === null)).toBe(true)
  })

  it('piramide: obiettivo diverso per ogni serie', () => {
    const v = creaVoce(panca, { serie: 3, repMin: 6, repMax: 10, repPerSerie: [10, 8, 6] }, [])
    expect(v.serie.map((s) => s.obiettivo)).toEqual([10, 8, 6])
  })
})

describe('statistiche', () => {
  it('massimale stimato', () => {
    expect(massimaleStimato(100, 1)).toBe(100)
    expect(massimaleStimato(60, 8)).toBe(76)
  })

  it('settimane di fila (la settimana in corso non interrompe)', () => {
    const s = (g: number) => sessione(g, [[60, 8, 'si']])
    expect(settimaneDiFila([s(1), s(8), s(15)], OGGI)).toBe(3)
    expect(settimaneDiFila([s(0), s(7), s(21)], OGGI)).toBe(2)
    expect(settimaneDiFila([s(30)], OGGI)).toBe(0)
  })
})
