import { useState } from 'react'
import { numero } from '../lib/formato'
import { useImpostazioni } from '../lib/impostazioni'
import { CampoNumero, Foglio } from './ui'

const COLORI: Record<string, { sfondo: string; testo: string; altezza: number }> = {
  '25': { sfondo: '#d93636', testo: '#fff', altezza: 100 },
  '20': { sfondo: '#2f6fe0', testo: '#fff', altezza: 100 },
  '15': { sfondo: '#e3b417', testo: '#1a1a1a', altezza: 90 },
  '10': { sfondo: '#2e9e5b', testo: '#fff', altezza: 80 },
  '5': { sfondo: '#e8e8e8', testo: '#1a1a1a', altezza: 64 },
  '2.5': { sfondo: '#333', testo: '#fff', altezza: 52 },
  '1.25': { sfondo: '#9aa0a8', testo: '#1a1a1a', altezza: 44 },
}

/** Dischi da caricare per lato (algoritmo goloso sui dischi disponibili) */
export function dischiPerLato(totale: number, bilanciere: number, disponibili: number[]): { dischi: number[]; resto: number } {
  let lato = (totale - bilanciere) / 2
  const dischi: number[] = []
  if (lato <= 0) return { dischi, resto: 0 }
  for (const d of [...disponibili].sort((a, b) => b - a)) {
    while (lato >= d - 1e-9) {
      dischi.push(d)
      lato = Math.round((lato - d) * 1000) / 1000
    }
  }
  return { dischi, resto: lato * 2 }
}

export function CalcolatoreDischi({ aperto, chiudi, kgIniziale }: { aperto: boolean; chiudi: () => void; kgIniziale?: number }) {
  const imp = useImpostazioni()
  const [kg, setKg] = useState<number | undefined>(kgIniziale)
  const [bilanciere, setBilanciere] = useState<number | undefined>(imp.pesoBilanciere)
  const totale = kg ?? 0
  const { dischi, resto } = dischiPerLato(totale, bilanciere ?? 0, imp.dischi)

  return (
    <Foglio aperto={aperto} chiudi={chiudi} titolo="Calcolatore dischi">
      <div className="colonna">
        <div className="griglia-2">
          <label className="campo">
            <span>Peso totale (kg)</span>
            <CampoNumero className="input" valore={kg} cambia={setKg} />
          </label>
          <label className="campo">
            <span>Bilanciere (kg)</span>
            <CampoNumero className="input" valore={bilanciere} cambia={setBilanciere} />
          </label>
        </div>
        <div className="card">
          <div className="dischi" aria-hidden="true">
            <div className="bilanciere" style={{ width: 40 }} />
            {dischi.map((d, i) => {
              const c = COLORI[String(d)] ?? { sfondo: '#777', testo: '#fff', altezza: 50 }
              return (
                <div key={i} className="disco" style={{ height: c.altezza, background: c.sfondo, color: c.testo }}>
                  {numero(d)}
                </div>
              )
            })}
            <div className="bilanciere" style={{ width: 24 }} />
          </div>
          <p className="centro" style={{ fontWeight: 600 }}>
            {dischi.length ? `Per lato: ${dischi.map((d) => numero(d)).join(' + ')}` : totale > 0 ? 'Solo bilanciere' : 'Inserisci il peso'}
          </p>
          {resto > 0.001 && <p className="centro piccolo attenzione">Mancano {numero(resto)} kg: non si può fare esatto con i tuoi dischi</p>}
        </div>
        <p className="piccolo muto">I dischi disponibili si cambiano nelle impostazioni.</p>
      </div>
    </Foglio>
  )
}
