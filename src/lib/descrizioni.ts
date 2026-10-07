import type { Obiettivo, TipoEsercizio } from '../db'
import { numero, recupero } from './formato'

/** "8", "8-10", "10/8/6" */
export function testoRipetizioni(o: Obiettivo): string {
  if (o.repPerSerie?.length) return o.repPerSerie.join('/')
  if (o.repMin === undefined) return ''
  if (o.repMax !== undefined && o.repMax !== o.repMin) return `${o.repMin}-${o.repMax}`
  return String(o.repMin)
}

export function leggiTestoRipetizioni(t: string, serie: number): Pick<Obiettivo, 'repMin' | 'repMax' | 'repPerSerie'> {
  const numeri = t
    .split(/\s*[-/–]\s*/)
    .map((x) => Number(x.trim()))
    .filter((n) => Number.isFinite(n) && n > 0)
  if (!numeri.length) return { repMin: undefined, repMax: undefined, repPerSerie: undefined }
  if (numeri.length === 1) return { repMin: numeri[0], repMax: numeri[0], repPerSerie: undefined }
  const piramide = t.includes('/') || numeri.length > 2
  const min = Math.min(...numeri)
  const max = Math.max(...numeri)
  if (!piramide) return { repMin: min, repMax: max, repPerSerie: undefined }
  const perSerie = Array.from({ length: Math.max(serie, numeri.length) }, (_, i) => numeri[Math.min(i, numeri.length - 1)])
  return { repMin: min, repMax: max, repPerSerie: perSerie }
}

/** "4 × 8-10 · 60 kg · rec 1'30"" */
export function descriviObiettivo(o: Obiettivo, tipo: TipoEsercizio, opzioni: { senzaRecupero?: boolean } = {}): string {
  const parti: string[] = []
  if (tipo === 'cardio') {
    if (o.durataMin) parti.push(`${numero(o.durataMin, 1)} min`)
    if (o.distanzaKm) parti.push(`${numero(o.distanzaKm)} km`)
    if (!parti.length) parti.push('Cardio')
  } else if (tipo === 'tempo') {
    parti.push(`${o.serie} × ${o.secondi ? recupero(o.secondi) : '?'}`)
  } else {
    const rip = testoRipetizioni(o)
    if (o.massimale) {
      parti.push(`${o.serie} × ${rip || '1'} ${!rip || rip === '1' ? 'colpo' : 'colpi'}`, 'massimale')
    } else parti.push(rip ? `${o.serie} × ${rip}` : `${o.serie} serie`)
    if (o.caricoKg) parti.push(`${numero(o.caricoKg)} kg`)
  }
  if (tipo !== 'cardio' && o.recuperoSec && !opzioni.senzaRecupero) parti.push(`rec ${recupero(o.recuperoSec)}`)
  return parti.join(' · ')
}

export const NOMI_TIPO: Record<TipoEsercizio, string> = {
  ripetizioni: 'Ripetizioni',
  tempo: 'A tempo',
  cardio: 'Cardio',
}

export { GRUPPI_CATALOGO as GRUPPI } from './catalogo'
