import { useEffect, useState, useSyncExternalStore } from 'react'
import { impostazioni } from './impostazioni'

/**
 * Timer di recupero basato sull'orario di fine: resta corretto anche se
 * l'iPhone blocca lo schermo o mette l'app in pausa.
 */
interface StatoTimer {
  fine: number | null
  durata: number
}

let stato: StatoTimer = { fine: null, durata: 0 }
const ascoltatori = new Set<() => void>()
let scadenza: ReturnType<typeof setTimeout> | undefined

function notifica(nuovo: StatoTimer) {
  stato = nuovo
  ascoltatori.forEach((a) => a())
}

function programma() {
  clearTimeout(scadenza)
  if (stato.fine === null) return
  scadenza = setTimeout(
    () => {
      if (stato.fine !== null && Date.now() >= stato.fine - 50) {
        notifica({ fine: null, durata: stato.durata })
        segnaleFine()
      } else programma()
    },
    Math.max(0, stato.fine - Date.now()),
  )
}

export function avviaRecupero(secondi: number) {
  sbloccaAudio()
  notifica({ fine: Date.now() + secondi * 1000, durata: secondi })
  programma()
}

export function modificaRecupero(deltaSec: number) {
  if (stato.fine === null) return
  const fine = Math.max(Date.now() + 1000, stato.fine + deltaSec * 1000)
  notifica({ fine, durata: Math.max(1, stato.durata + deltaSec) })
  programma()
}

export function fermaRecupero() {
  clearTimeout(scadenza)
  notifica({ fine: null, durata: 0 })
}

export function useTimer(): StatoTimer {
  return useSyncExternalStore(
    (cb) => {
      ascoltatori.add(cb)
      return () => ascoltatori.delete(cb)
    },
    () => stato,
  )
}

/** Secondi rimanenti, aggiornati più volte al secondo */
export function useSecondiRimanenti(fine: number | null): number {
  const [adesso, setAdesso] = useState(Date.now())
  useEffect(() => {
    if (fine === null) return
    const t = setInterval(() => setAdesso(Date.now()), 250)
    return () => clearInterval(t)
  }, [fine])
  return fine === null ? 0 : Math.max(0, Math.ceil((fine - adesso) / 1000))
}

// --- suono (su iPhone l'audio va "sbloccato" con un tocco dell'utente) ---

let audio: AudioContext | undefined

export function sbloccaAudio() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    audio ??= new Ctx()
    if (audio.state === 'suspended') void audio.resume()
  } catch {
    // audio non disponibile
  }
}

function bip(inizio: number, frequenza: number, durata: number) {
  if (!audio) return
  const osc = audio.createOscillator()
  const vol = audio.createGain()
  osc.type = 'sine'
  osc.frequency.value = frequenza
  vol.gain.setValueAtTime(0.0001, inizio)
  vol.gain.exponentialRampToValueAtTime(0.4, inizio + 0.02)
  vol.gain.exponentialRampToValueAtTime(0.0001, inizio + durata)
  osc.connect(vol).connect(audio.destination)
  osc.start(inizio)
  osc.stop(inizio + durata + 0.05)
}

function segnaleFine() {
  if (impostazioni().suono && audio) {
    const t = audio.currentTime
    bip(t, 880, 0.18)
    bip(t + 0.25, 880, 0.18)
    bip(t + 0.5, 1320, 0.35)
  }
  navigator.vibrate?.([200, 100, 200])
}
