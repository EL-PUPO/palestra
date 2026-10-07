import { describe, expect, it } from 'vitest'
import { conValore } from '../componenti/Serie'
import type { Sessione, VoceSessione } from '../db'
import { eMassimale, esitoDa, recuperoDellAllenamento } from './allenamento'
import { leggiRigaEsercizio } from './leggiScheda'
import { recordForza, storicoEsercizio, suggerisci } from './statistiche'

const voce = (serie: VoceSessione['serie'], obiettivo: VoceSessione['obiettivo'] = { serie: 3, repMin: 8, repMax: 8 }): VoceSessione => ({
  uid: 'v',
  esercizioId: 'panca',
  tipo: 'ripetizioni',
  obiettivo,
  serie,
})

describe('massimale', () => {
  it('1 colpo è sempre un massimale, sopra i 3 non più', () => {
    expect(eMassimale(1, false)).toBe(true)
    expect(eMassimale(2, true)).toBe(true)
    expect(eMassimale(3, false)).toBe(false)
    expect(eMassimale(3, false, { serie: 1, massimale: true })).toBe(true)
    expect(eMassimale(4, true)).toBe(false)
  })

  it('scendendo a 1 con il − la serie diventa massimale e non è "mancata"', () => {
    let v = voce([{ obiettivo: 8, kg: 100, valore: 8, esito: 'si' }])
    v = conValore(v, 0, 1)
    expect(v.serie[0]).toMatchObject({ valore: 1, massimale: true, esito: 'si' })
    v = conValore(v, 0, 2)
    expect(v.serie[0]).toMatchObject({ valore: 2, massimale: true })
    v = conValore(v, 0, 4)
    expect(v.serie[0]).toMatchObject({ valore: 4, massimale: undefined, esito: 'no' })
  })

  it('un massimale fallito (0 colpi) è segnato come non riuscito', () => {
    expect(esitoDa({ obiettivo: 1, valore: 0, esito: null, massimale: true })).toBe('no')
  })

  it('la scheda riconosce massimale, 1RM, colpi e 3x1', () => {
    expect(leggiRigaEsercizio('Panca piana massimale')[0]).toMatchObject({ nome: 'Panca piana', massimale: true, serie: 1, repMin: 1, repMax: 1 })
    expect(leggiRigaEsercizio('Squat max 3 colpi')[0]).toMatchObject({ nome: 'Squat', massimale: true, repMin: 1, repMax: 3 })
    expect(leggiRigaEsercizio('Stacco 1RM')[0]).toMatchObject({ nome: 'Stacco', massimale: true })
    expect(leggiRigaEsercizio('Panca 3x1 rec 3\'')[0]).toMatchObject({ serie: 3, repMin: 1, massimale: true, recuperoSec: 180 })
    expect(leggiRigaEsercizio('Panca 4x8')[0].massimale).toBeUndefined()
  })

  it('massimale reale nei record e niente "serie mancate" nei suggerimenti', () => {
    const s: Sessione = {
      id: 's',
      nomeGiorno: 'A',
      inizio: 1,
      fine: 2,
      voci: [
        voce([
          { obiettivo: 8, kg: 80, valore: 8, esito: 'si' },
          { obiettivo: 8, kg: 80, valore: 8, esito: 'si' },
          { obiettivo: 8, kg: 80, valore: 8, esito: 'si' },
          { obiettivo: 8, kg: 110, valore: 1, esito: 'si', massimale: true },
        ]),
      ],
    }
    const st = storicoEsercizio([s], 'panca')
    expect(recordForza(st).massimaleReale).toMatchObject({ kg: 110 })
    expect(suggerisci(st, { serie: 3, repMin: 8, repMax: 8 }, 2.5, 1)).toMatchObject({ tipo: 'aumenta', kg: 82.5 })
  })
})

describe('recupero unico', () => {
  it('prende il recupero più usato nella scheda', () => {
    const v = (rec?: number): VoceSessione => voce([], { serie: 3, repMin: 8, repMax: 8, recuperoSec: rec })
    expect(recuperoDellAllenamento([v(120), v(90), v(90), v()])).toBe(90)
  })
})
