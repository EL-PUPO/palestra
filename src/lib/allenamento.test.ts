import { describe, expect, it } from 'vitest'
import { conKg, conValore, serieRiscaldamento } from '../componenti/Serie'
import type { VoceSessione } from '../db'
import { esitoCardio, esitoDa } from './allenamento'

describe('esito delle serie con − 0 +', () => {
  it('0 o più del previsto = completa, meno = non completa', () => {
    expect(esitoDa({ obiettivo: 8, valore: 8, esito: null })).toBe('si')
    expect(esitoDa({ obiettivo: 8, valore: 10, esito: null })).toBe('si')
    expect(esitoDa({ obiettivo: 8, valore: 6, esito: null })).toBe('no')
    expect(esitoDa({ valore: 12, esito: null })).toBe('si')
    expect(esitoDa({ obiettivo: 8, esito: null })).toBeNull()
  })

  it('cardio sotto il previsto', () => {
    expect(esitoCardio({ serie: 1, durataMin: 20 }, { durataMin: 20, esito: null })).toBe('si')
    expect(esitoCardio({ serie: 1, durataMin: 20 }, { durataMin: 15, esito: null })).toBe('no')
    expect(esitoCardio({ serie: 1, distanzaKm: 5 }, { durataMin: 30, distanzaKm: 5.2, esito: null })).toBe('si')
    expect(esitoCardio({ serie: 1 }, { esito: null })).toBeNull()
  })

  const voce = (): VoceSessione => ({
    uid: 'v',
    esercizioId: 'e',
    tipo: 'ripetizioni',
    obiettivo: { serie: 3, repMin: 8, repMax: 8 },
    serie: [
      { obiettivo: 8, kg: 60, valore: 8, esito: 'si' },
      { obiettivo: 8, kg: 60, valore: 8, esito: null },
      { obiettivo: 8, valore: 8, esito: null },
    ],
  })

  it('il + su una serie già fatta ricalcola l’esito', () => {
    expect(conValore(voce(), 0, 6).serie[0]).toMatchObject({ valore: 6, esito: 'no' })
    expect(conValore(voce(), 1, 9).serie[1]).toMatchObject({ valore: 9, esito: null })
  })

  it('il carico si ricopia solo sulle serie dopo non ancora fatte', () => {
    expect(conKg(voce(), 1, 65).serie.map((s) => s.kg)).toEqual([60, 65, 65])
    expect(conKg(voce(), 0, 62.5).serie.map((s) => s.kg)).toEqual([62.5, 62.5, 62.5])
    const diversa = voce()
    diversa.serie[2].kg = 70
    expect(conKg(diversa, 1, 65).serie.map((s) => s.kg)).toEqual([60, 65, 70])
  })
})

describe('riscaldamento', () => {
  it('bilanciere vuoto, poi 40-60-80%', () => {
    expect(serieRiscaldamento(100, 20)).toEqual([
      { kg: 20, rip: 10 },
      { kg: 40, rip: 8 },
      { kg: 60, rip: 5 },
      { kg: 80, rip: 3 },
    ])
  })
  it('senza bilanciere salta la prima', () => {
    expect(serieRiscaldamento(30, 0)).toEqual([
      { kg: 12.5, rip: 8 },
      { kg: 17.5, rip: 5 },
      { kg: 25, rip: 3 },
    ])
  })
})
