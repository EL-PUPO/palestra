import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { chiaveGiorno } from '../lib/formato'

const INTESTAZIONI = ['L', 'M', 'M', 'G', 'V', 'S', 'D']

/** Mese con i giorni di allenamento evidenziati */
export function Calendario({ giorniAllenati, scegli, selezionato }: { giorniAllenati: Set<string>; scegli?: (giorno: string) => void; selezionato?: string | null }) {
  const [mese, setMese] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const primo = (mese.getDay() + 6) % 7
  const giorniNelMese = new Date(mese.getFullYear(), mese.getMonth() + 1, 0).getDate()
  const oggi = chiaveGiorno()
  const celle: (string | null)[] = [...Array(primo).fill(null), ...Array.from({ length: giorniNelMese }, (_, i) => chiaveGiorno(new Date(mese.getFullYear(), mese.getMonth(), i + 1)))]
  const conteggio = celle.filter((c) => c && giorniAllenati.has(c)).length
  const cambia = (d: number) => setMese(new Date(mese.getFullYear(), mese.getMonth() + d, 1))

  return (
    <div className="card">
      <div className="card-titolo">
        <button className="btn-icona" aria-label="Mese precedente" onClick={() => cambia(-1)}>
          <ChevronLeft size={20} />
        </button>
        <div className="centro">
          <h3 style={{ textTransform: 'capitalize' }}>{mese.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}</h3>
          <p className="piccolo muto">
            {conteggio} {conteggio === 1 ? 'allenamento' : 'allenamenti'}
          </p>
        </div>
        <button className="btn-icona" aria-label="Mese successivo" onClick={() => cambia(1)}>
          <ChevronRight size={20} />
        </button>
      </div>
      <div className="calendario">
        {INTESTAZIONI.map((g, i) => (
          <div key={i} className="intestazione">
            {g}
          </div>
        ))}
        {celle.map((c, i) =>
          c ? (
            <button
              key={c}
              className={`giorno${giorniAllenati.has(c) ? ' allenato' : ''}${c === oggi ? ' oggi' : ''}`}
              style={selezionato === c ? { outline: '2px solid var(--testo)', outlineOffset: -2 } : undefined}
              onClick={() => scegli?.(c)}
              aria-label={c}
            >
              {Number(c.slice(-2))}
            </button>
          ) : (
            <div key={`v${i}`} className="giorno fuori" />
          ),
        )}
      </div>
    </div>
  )
}
