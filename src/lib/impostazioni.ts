import { useSyncExternalStore } from 'react'

export type Tema = 'auto' | 'chiaro' | 'scuro'
export type Accento = 'blu' | 'verde' | 'arancio' | 'rosso' | 'viola' | 'rosa' | 'ciano'

export interface Impostazioni {
  tema: Tema
  accento: Accento
  testo: 'normale' | 'grande'
  recuperoPredefinito: number
  incrementoKg: number
  /** quante sessioni di fila con tutte le ripetizioni prima di suggerire di aumentare */
  sessioniPerAumento: number
  pesoBilanciere: number
  dischi: number[]
  obiettivoSettimanale: number
  schermoAcceso: boolean
  suono: boolean
  recuperoAutomatico: boolean
  /** passa da solo all'esercizio successivo quando finisci le serie */
  avanzamentoAutomatico: boolean
  /** mostra il tempo trascorso durante l'allenamento */
  mostraCronometro: boolean
  /** playlist o video di YouTube salvati */
  musica: BranoMusica[]
  musicaScelta: number
  ultimoBackup?: number
}

/** Una playlist (o un video) di YouTube salvata */
export interface BranoMusica {
  nome: string
  link: string
  /** YouTube non la fa ascoltare dentro l'app (blocco della casa discografica) */
  bloccata?: boolean
}

export const PREDEFINITE: Impostazioni = {
  tema: 'auto',
  accento: 'blu',
  testo: 'normale',
  recuperoPredefinito: 90,
  incrementoKg: 2.5,
  sessioniPerAumento: 1,
  pesoBilanciere: 20,
  dischi: [25, 20, 15, 10, 5, 2.5, 1.25],
  obiettivoSettimanale: 3,
  schermoAcceso: true,
  suono: true,
  recuperoAutomatico: true,
  avanzamentoAutomatico: true,
  mostraCronometro: true,
  musica: [],
  musicaScelta: 0,
}

// letta anche dallo script in index.html per applicare il tema prima del primo render
const CHIAVE = 'palestra-impostazioni'

function leggi(): Impostazioni {
  try {
    const salvate = JSON.parse(localStorage.getItem(CHIAVE) ?? '{}')
    return { ...PREDEFINITE, ...salvate }
  } catch {
    return { ...PREDEFINITE }
  }
}

let correnti = leggi()
const ascoltatori = new Set<() => void>()

export function impostazioni(): Impostazioni {
  return correnti
}

export function aggiornaImpostazioni(modifiche: Partial<Impostazioni>) {
  correnti = { ...correnti, ...modifiche }
  try {
    localStorage.setItem(CHIAVE, JSON.stringify(correnti))
  } catch {
    // memoria piena o non disponibile: le impostazioni restano valide fino alla chiusura
  }
  applicaTema()
  ascoltatori.forEach((a) => a())
}

export function sostituisciImpostazioni(nuove: Partial<Impostazioni>) {
  correnti = { ...PREDEFINITE }
  aggiornaImpostazioni(nuove)
}

export function useImpostazioni(): Impostazioni {
  return useSyncExternalStore(
    (cb) => {
      ascoltatori.add(cb)
      return () => ascoltatori.delete(cb)
    },
    () => correnti,
  )
}

const scuroDiSistema = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null

export function temaEffettivo(): 'chiaro' | 'scuro' {
  if (correnti.tema !== 'auto') return correnti.tema
  return scuroDiSistema?.matches ? 'scuro' : 'chiaro'
}

export function applicaTema() {
  if (typeof document === 'undefined') return
  const radice = document.documentElement
  radice.dataset.tema = temaEffettivo()
  radice.dataset.accento = correnti.accento
  radice.dataset.testo = correnti.testo
  const sfondo = getComputedStyle(radice).getPropertyValue('--sfondo').trim()
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', sfondo || '#0f1115')
}

scuroDiSistema?.addEventListener('change', () => {
  if (correnti.tema === 'auto') applicaTema()
})
