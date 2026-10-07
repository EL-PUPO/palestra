import { useSyncExternalStore } from 'react'

/**
 * Pannello della musica aperto o chiuso, uguale in tutte le pagine:
 * se lo apri in Home resta aperto quando inizi l'allenamento.
 */
let aperto = false
const ascoltatori = new Set<() => void>()

export function useMusicaAperta(): boolean {
  return useSyncExternalStore(
    (cb) => {
      ascoltatori.add(cb)
      return () => ascoltatori.delete(cb)
    },
    () => aperto,
  )
}

export function impostaMusicaAperta(valore: boolean) {
  aperto = valore
  ascoltatori.forEach((a) => a())
}

/** Dove era arrivato YouTube, per riprendere da lì quando il lettore riappare in un'altra pagina */
export interface PosizioneYouTube {
  indirizzo: string
  indice: number
  tempo: number
  suonava: boolean
}

let posizione: PosizioneYouTube | undefined

export function salvaPosizioneYouTube(p: PosizioneYouTube) {
  posizione = p
}

export function posizioneYouTube(indirizzo: string): PosizioneYouTube | undefined {
  return posizione?.indirizzo === indirizzo ? posizione : undefined
}
