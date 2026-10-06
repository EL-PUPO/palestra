import { describe, expect, it } from 'vitest'
import { normalizzaNome } from './formato'
import { CATALOGO, GRUPPI_CATALOGO, cercaNelCatalogo, indovinaGruppo } from './catalogo'

describe('libreria esercizi', () => {
  it('è ampia e senza doppioni', () => {
    expect(CATALOGO.length).toBeGreaterThan(200)
    const nomi = CATALOGO.map((e) => normalizzaNome(e.nome))
    expect(new Set(nomi).size).toBe(nomi.length)
    for (const g of GRUPPI_CATALOGO) expect(CATALOGO.some((e) => e.gruppo === g)).toBe(true)
  })

  it('trova anche il nome tra parentesi o senza', () => {
    expect(cercaNelCatalogo('leg press')?.nome).toBe('Pressa 45° (leg press)')
    expect(cercaNelCatalogo('Pressa 45°')?.nome).toBe('Pressa 45° (leg press)')
    expect(cercaNelCatalogo('pec deck')?.gruppo).toBe('Petto')
    expect(cercaNelCatalogo('Plank')?.tipo).toBe('tempo')
    expect(cercaNelCatalogo('Vogatore')?.tipo).toBe('cardio')
  })

  it('indovina il gruppo di esercizi scritti a mano', () => {
    const casi: [string, string][] = [
      ['Panca piana con bilanciere', 'Petto'],
      ['Croci ai cavi o pec deck', 'Petto'],
      ['Alzate laterali ai cavi', 'Spalle'],
      ['Pushdown ai cavi', 'Tricipiti'],
      ['French press / estensioni sopra la testa', 'Tricipiti'],
      ['Trazioni zavorrate', 'Dorso'],
      ['Rematore su T-bar o chest supported', 'Dorso'],
      ['Face pull o reverse pec deck', 'Spalle'],
      ['Curl su panca inclinata con manubri', 'Bicipiti'],
      ['Squat', 'Quadricipiti'],
      ['Affondi bulgari', 'Quadricipiti'],
      ['Leg curl da seduto', 'Femorali'],
      ['Stacco rumeno', 'Femorali'],
      ['Calf in piedi', 'Polpacci'],
      ['Hip thrust', 'Glutei'],
      ['Crunch ai cavi', 'Addome'],
      ['Military press o shoulder press con manubri', 'Spalle'],
      ['Tapis roulant', 'Cardio'],
    ]
    for (const [nome, gruppo] of casi) expect([nome, indovinaGruppo(nome)]).toEqual([nome, gruppo])
  })
})
