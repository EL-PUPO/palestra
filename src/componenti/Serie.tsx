import type { ReactNode } from 'react'
import { db, type SerieRegistrata, type TipoEsercizio, type VoceSessione } from '../db'
import { eMassimale, esitoDa } from '../lib/allenamento'
import { numero, recupero } from '../lib/formato'
import { serieFatte, type Prestazione } from '../lib/statistiche'
import { CampoNumero, Contatore, Foglio } from './ui'

/** Aggiorna una voce leggendo la sessione aggiornata dal database (così i tocchi rapidi non si perdono) */
export function aggiornaVoce(idSessione: string, uid: string, f: (v: VoceSessione) => VoceSessione) {
  return db.transaction('rw', db.sessioni, async () => {
    const s = await db.sessioni.get(idSessione)
    if (s) await db.sessioni.update(idSessione, { voci: s.voci.map((v) => (v.uid === uid ? f(v) : v)) })
  })
}

/** Cambia il carico di una serie e lo ricopia sulle successive non ancora fatte */
export function conKg(v: VoceSessione, i: number, kg: number | undefined): VoceSessione {
  const prima = v.serie[i]?.kg
  return {
    ...v,
    serie: v.serie.map((x, j) => (j === i || (j > i && x.esito === null && (x.kg === undefined || x.kg === prima)) ? { ...x, kg } : x)),
  }
}

/** Cambia le ripetizioni fatte (1 colpo = massimale); se la serie era già segnata, ne ricalcola l'esito */
export function conValore(v: VoceSessione, i: number, valore: number): VoceSessione {
  return {
    ...v,
    serie: v.serie.map((x, j) => {
      if (j !== i) return x
      const nuova = { ...x, valore, massimale: eMassimale(valore, x.massimale, v.obiettivo) || undefined }
      return { ...nuova, esito: x.esito === null ? null : esitoDa(nuova) }
    }),
  }
}

export function serieInPiu(v: VoceSessione, obiettivo: number | undefined): VoceSessione {
  const ultima = v.serie[v.serie.length - 1]
  const o = obiettivo ?? ultima?.obiettivo
  return { ...v, serie: [...v.serie, { obiettivo: o, kg: ultima?.kg, valore: o ?? ultima?.valore, esito: null }] }
}

export function UltimaVolta({ p }: { p: Prestazione }) {
  const v = p.voce
  if (v.tipo === 'cardio') {
    const c = v.cardio
    return <span>{[c?.durataMin && `${numero(c.durataMin, 1)} min`, c?.distanzaKm && `${numero(c.distanzaKm)} km`].filter(Boolean).join(' · ') || '—'}</span>
  }
  return (
    <span>
      {serieFatte(v).map((s, i) => (
        <span key={i} className={s.esito === 'no' ? 'attenzione' : undefined}>
          {i > 0 && ' · '}
          {v.tipo === 'ripetizioni' && s.kg !== undefined ? `${numero(s.kg)}×` : ''}
          {v.tipo === 'tempo' ? recupero(s.valore) : s.valore}
          {s.massimale ? ' MAX' : ''}
        </span>
      ))}
    </span>
  )
}

export function IntestazioneSerie({ tipo, ultima }: { tipo: TipoEsercizio; ultima?: string }) {
  return (
    <div className="serie-intestazione">
      <span>#</span>
      <span>{tipo === 'ripetizioni' ? 'Kg' : ''}</span>
      <span className="centro">{tipo === 'tempo' ? 'Secondi' : 'Rip. vs previste'}</span>
      <span className="centro">{ultima ?? ''}</span>
    </div>
  )
}

export function RigaSerie({
  s,
  i,
  tipo,
  cambiaKg,
  cambiaValore,
  azione,
  colorata = true,
}: {
  s: SerieRegistrata
  i: number
  tipo: TipoEsercizio
  cambiaKg: (kg: number | undefined) => void
  cambiaValore: (v: number) => void
  azione: ReactNode
  /** colora la riga in base all'esito (verde/arancio) */
  colorata?: boolean
}) {
  return (
    <div className={`serie-riga ${colorata ? (s.esito ?? '') : ''}`}>
      {s.massimale ? (
        <span className="badge-max" title="Massimale">
          MAX
        </span>
      ) : (
        <span className="serie-n">{i + 1}</span>
      )}
      <div className="serie-campi">
        {tipo === 'ripetizioni' ? (
          <CampoNumero className="kg" valore={s.kg} placeholder="kg" aria-label={`Kg serie ${i + 1}`} cambia={cambiaKg} />
        ) : (
          <span className="piccolo muto">{s.obiettivo ? `previsti ${recupero(s.obiettivo)}` : ''}</span>
        )}
      </div>
      {s.massimale ? (
        <Contatore obiettivo={undefined} valore={s.valore} cambia={cambiaValore} unita={s.valore === 1 ? 'colpo' : 'colpi'} solaLettura />
      ) : (
        <Contatore obiettivo={s.obiettivo} valore={s.valore} cambia={cambiaValore} passo={tipo === 'tempo' ? 5 : 1} unita={tipo === 'tempo' ? 's' : 'rip'} />
      )}
      {azione}
    </div>
  )
}

/** Serie di riscaldamento prima del carico di lavoro (bilanciere vuoto, 40%, 60%, 80%) */
export function serieRiscaldamento(kgLavoro: number, bilanciere: number): { kg: number; rip: number }[] {
  const piano: [number, number][] = [
    [0, 10],
    [0.4, 8],
    [0.6, 5],
    [0.8, 3],
  ]
  const risultato: { kg: number; rip: number }[] = []
  for (const [percentuale, rip] of piano) {
    const kg = percentuale === 0 ? bilanciere : Math.max(bilanciere, Math.round((kgLavoro * percentuale) / 2.5) * 2.5)
    if (kg <= 0 || kg >= kgLavoro || risultato.some((r) => r.kg === kg)) continue
    risultato.push({ kg, rip })
  }
  return risultato
}

export function Riscaldamento({ aperto, chiudi, kg, bilanciere }: { aperto: boolean; chiudi: () => void; kg?: number; bilanciere: number }) {
  const serie = kg ? serieRiscaldamento(kg, bilanciere) : []
  return (
    <Foglio aperto={aperto} chiudi={chiudi} titolo="Riscaldamento">
      {serie.length ? (
        <div className="colonna">
          <p className="piccolo muto">Prima delle serie di lavoro a {numero(kg)} kg, con poco recupero tra una e l'altra:</p>
          <div className="lista">
            {serie.map((r, i) => (
              <div key={i} className="voce">
                <span className="serie-n">{i + 1}</span>
                <span className="cresci" style={{ fontWeight: 600 }}>
                  {numero(r.kg)} kg
                </span>
                <span className="muto">× {r.rip}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="muto">Scrivi prima il carico della prima serie.</p>
      )}
    </Foglio>
  )
}
