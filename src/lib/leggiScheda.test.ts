import { describe, expect, it } from 'vitest'
import { leggiRigaEsercizio, leggiScheda } from './leggiScheda'

const riga = (t: string) => leggiRigaEsercizio(t)[0]

describe('riga esercizio', () => {
  it('serie × ripetizioni con recupero', () => {
    expect(riga(`Panca piana 4x8 rec 90''`)).toMatchObject({ nome: 'Panca piana', tipo: 'ripetizioni', serie: 4, repMin: 8, repMax: 8, recuperoSec: 90 })
  })
  it('range di ripetizioni e recupero in minuti e secondi', () => {
    expect(riga(`Lat machine 4 x 10-12 rec. 1'30`)).toMatchObject({ nome: 'Lat machine', serie: 4, repMin: 10, repMax: 12, recuperoSec: 90 })
  })
  it('recupero senza parola "rec"', () => {
    expect(riga(`Rematore manubrio 3x10 1'30"`)).toMatchObject({ serie: 3, repMin: 10, recuperoSec: 90 })
    expect(riga(`Curl bilanciere 3x12 60"`)).toMatchObject({ serie: 3, repMin: 12, recuperoSec: 60 })
  })
  it('recupero scritto dopo', () => {
    expect(riga(`Squat 4x6-8 2' di recupero`)).toMatchObject({ nome: 'Squat', serie: 4, repMin: 6, repMax: 8, recuperoSec: 120 })
  })
  it('"serie da"', () => {
    expect(riga('Croci ai cavi 3 serie da 12')).toMatchObject({ nome: 'Croci ai cavi', serie: 3, repMin: 12 })
  })
  it('piramidale', () => {
    expect(riga('Panca inclinata 4x10/8/6/6')).toMatchObject({ serie: 4, repPerSerie: [10, 8, 6, 6], repMin: 6, repMax: 10 })
    expect(riga('Stacco 4x10/8/6')).toMatchObject({ repPerSerie: [10, 8, 6, 6] })
  })
  it('carico', () => {
    expect(riga('Squat 5x5 @ 80kg')).toMatchObject({ nome: 'Squat', serie: 5, repMin: 5, caricoKg: 80 })
    expect(riga('Leg press 4x10 120 kg')).toMatchObject({ caricoKg: 120 })
  })
  it('a tempo', () => {
    expect(riga(`Plank 3x30''`)).toMatchObject({ nome: 'Plank', tipo: 'tempo', serie: 3, secondi: 30 })
    expect(riga('Plank 3x45')).toMatchObject({ tipo: 'tempo', secondi: 45 })
    expect(riga(`Wall sit 3x1'`)).toMatchObject({ tipo: 'tempo', secondi: 60 })
  })
  it('a cedimento', () => {
    expect(riga('Crunch 3xmax')).toMatchObject({ nome: 'Crunch', serie: 3, note: 'A cedimento' })
  })
  it('cardio a tempo e distanza', () => {
    expect(riga('Tapis roulant 20 min inclinazione 10%')).toMatchObject({ nome: 'Tapis roulant', tipo: 'cardio', durataMin: 20, note: 'inclinazione 10%' })
    expect(riga(`Cyclette 30'`)).toMatchObject({ tipo: 'cardio', durataMin: 30 })
    expect(riga('Corsa 5 km')).toMatchObject({ tipo: 'cardio', distanzaKm: 5 })
    expect(riga('Vogatore 2000 m')).toMatchObject({ tipo: 'cardio', distanzaKm: 2 })
    expect(riga('Camminata 45 min a 6 km/h')).toMatchObject({ tipo: 'cardio', durataMin: 45, note: 'a 6 km/h' })
  })
  it('"corda" con serie non è cardio', () => {
    expect(riga(`Push down corda 3x15 rec 60"`)).toMatchObject({ nome: 'Push down corda', tipo: 'ripetizioni', serie: 3, repMin: 15, recuperoSec: 60 })
  })
  it('punti elenco e maiuscole', () => {
    expect(riga('1. Military press 4x8')).toMatchObject({ nome: 'Military press', serie: 4 })
    expect(riga('- PANCA PIANA 4X8')).toMatchObject({ nome: 'Panca piana', serie: 4, repMin: 8 })
  })
  it('note tra parentesi', () => {
    expect(riga('Affondi (per gamba) 3x10')).toMatchObject({ nome: 'Affondi', note: 'per gamba', serie: 3 })
  })
  it('tabella a colonne', () => {
    expect(riga('Panca piana\t4\t8\t90"')).toMatchObject({ nome: 'Panca piana', serie: 4, repMin: 8, recuperoSec: 90 })
  })
  it('superserie sulla stessa riga', () => {
    const r = leggiRigaEsercizio('Panca 4x8 + croci 3x12')
    expect(r).toHaveLength(2)
    expect(r[0]).toMatchObject({ nome: 'Panca', serie: 4, note: 'Superserie' })
    expect(r[1]).toMatchObject({ nome: 'Croci', serie: 3, repMin: 12 })
  })
  it('esercizio senza dati viene segnalato', () => {
    expect(riga('Addominali a scelta')).toMatchObject({ nome: 'Addominali a scelta', incerto: true, serie: 3 })
  })
})

describe('scheda completa', () => {
  it('giorni con parola chiave e gruppi muscolari', () => {
    const s = leggiScheda(`Scheda ipertrofia ottobre

GIORNO A - PETTO E TRICIPITI
PETTO
Panca piana 4x8 rec 2'
Croci manubri 3x12 rec 90"
TRICIPITI
French press 3x10
Tapis 15 min

GIORNO B - DORSO
Lat machine 4x10
Rematore 4x10
Recupero 90" tra le serie
`)
    expect(s.titolo).toBe('Scheda ipertrofia ottobre')
    expect(s.giorni.map((g) => g.nome)).toEqual(['Giorno 1 - Petto e tricipiti', 'Giorno 2 - Dorso'])
    expect(s.giorni[0].esercizi.map((e) => e.nome)).toEqual(['Panca piana', 'Croci manubri', 'French press', 'Tapis'])
    expect(s.giorni[0].esercizi[0]).toMatchObject({ gruppo: 'Petto', recuperoSec: 120 })
    expect(s.giorni[0].esercizi[2]).toMatchObject({ gruppo: 'Tricipiti' })
    expect(s.giorni[0].esercizi[3]).toMatchObject({ tipo: 'cardio', durataMin: 15 })
    expect(s.giorni[1].esercizi.every((e) => e.recuperoSec === 90)).toBe(true)
  })

  it('giorni con lettere', () => {
    const s = leggiScheda(`A)
Squat 4x8
Leg curl 3x12
B)
Panca 4x8`)
    expect(s.giorni).toHaveLength(2)
    expect(s.giorni[1].esercizi[0].nome).toBe('Panca')
  })

  it('giorni separati da righe vuote con titolo', () => {
    const s = leggiScheda(`Petto e spalle
Panca 4x8
Lento avanti 3x10

Gambe
Squat 5x5
Corsa 3 km`)
    expect(s.giorni.map((g) => g.nome)).toEqual(['Petto e spalle', 'Gambe'])
    expect(s.giorni[1].esercizi[1]).toMatchObject({ tipo: 'cardio', distanzaKm: 3 })
  })

  it('giorni scritti in maiuscolo', () => {
    const s = leggiScheda(`PUSH
Panca 4x8
PULL
Trazioni 4xmax
LEGS
Squat 4x8`)
    expect(s.giorni.map((g) => g.nome)).toEqual(['Push', 'Pull', 'Legs'])
  })

  it('giorni della settimana', () => {
    const s = leggiScheda(`Lunedì: petto
Panca 4x8
Mercoledì: gambe (circa 60 min)
Squat 4x8`)
    expect(s.giorni.map((g) => g.nome)).toEqual(['Lunedì: petto', 'Mercoledì: gambe'])
  })

  it('senza intestazioni diventa un solo giorno', () => {
    const s = leggiScheda(`Panca 4x8
Squat 4x8
Plank 3x30"`)
    expect(s.giorni).toHaveLength(1)
    expect(s.giorni[0].nome).toBe('Giorno 1')
    expect(s.giorni[0].esercizi).toHaveLength(3)
  })

  it('tabella copiata con "(20 serie)" nel titolo del giorno', () => {
    const s = leggiScheda(
      [
        'Giorno 1: Push (20 serie)',
        'Esercizio\tSerie × Rip',
        'Panca piana con bilanciere\t4 × 6-8',
        'Croci ai cavi o pec deck\t3 × 12-15',
        'Giorno 2: Pull (22 serie)',
        'Esercizio\tSerie × Rip',
        'Trazioni zavorrate\t4 × 6-8',
        'Giorno 3: Legs, focus quadricipiti (~21 serie)',
        'Esercizio\tSerie × Rip',
        'Affondi bulgari\t2 × 8-10 per gamba',
        'Dip (zavorrate se possibile)\t3 × 8-10',
        '',
        'Gli affondi bulgari valgono 4 serie di tempo, perché si lavora una gamba alla volta.',
        '',
        'Giorno 4: Upper (22 serie)',
        'Esercizio\tSerie × Rip',
        'Military press o shoulder press con manubri\t4 × 6-8',
      ].join('\n'),
    )
    expect(s.giorni.map((g) => g.nome)).toEqual(['Giorno 1: Push', 'Giorno 2: Pull', 'Giorno 3: Legs, focus quadricipiti', 'Giorno 4: Upper'])
    expect(s.giorni.map((g) => g.esercizi.length)).toEqual([2, 1, 2, 1])
    expect(s.giorni[0].esercizi[0]).toMatchObject({ nome: 'Panca piana con bilanciere', serie: 4, repMin: 6, repMax: 8 })
    expect(s.giorni[2].esercizi[0]).toMatchObject({ nome: 'Affondi bulgari', serie: 2, note: 'per gamba' })
    expect(s.giorni[2].esercizi[1]).toMatchObject({ nome: 'Dip', note: 'zavorrate se possibile' })
    expect(s.ignorate).toHaveLength(1)
  })

  it('formattazione markdown, emoji e ordinali', () => {
    const s = leggiScheda(`**🔥 1° giorno – Petto**
- **Panca piana** – 4x8
2) Croci 3*12
## Secondo giorno
| Squat | 4 | 8 | 90" |`)
    expect(s.giorni.map((g) => g.nome)).toEqual(['1° giorno – Petto', 'Secondo giorno'])
    expect(s.giorni[0].esercizi.map((e) => [e.nome, e.serie, e.repMin])).toEqual([
      ['Panca piana', 4, 8],
      ['Croci', 3, 12],
    ])
    expect(s.giorni[1].esercizi[0]).toMatchObject({ nome: 'Squat', serie: 4, repMin: 8, recuperoSec: 90 })
  })

  it('titoli dei giorni senza parola chiave, senza righe vuote', () => {
    const s = leggiScheda(`Petto e tricipiti
Panca 4x8
French press 3x10
Dorso e bicipiti
Lat machine 4x10
Curl 3x12`)
    expect(s.giorni.map((g) => g.nome)).toEqual(['Petto e tricipiti', 'Dorso e bicipiti'])
  })

  it('blocchi separati da righe vuote senza titolo', () => {
    const s = leggiScheda(`Panca 4x8
Croci 3x12

Squat 4x8
Leg press 4x10`)
    expect(s.giorni.map((g) => g.nome)).toEqual(['Giorno 1', 'Giorno 2'])
  })

  it('le lettere diventano numeri', () => {
    const s = leggiScheda(`Giorno A
Panca 4x8
Giorno B - Gambe
Squat 4x8
C)
Stacco 3x5`)
    expect(s.giorni.map((g) => g.nome)).toEqual(['Giorno 1', 'Giorno 2 - Gambe', 'Giorno 3'])
  })

  it('"Scheda A" / "Scheda B" sono giorni', () => {
    const s = leggiScheda(`SCHEDA A
Panca 4x8
SCHEDA B
Squat 4x8`)
    expect(s.giorni.map((g) => g.nome)).toEqual(['Scheda A', 'Scheda B'])
  })
})
