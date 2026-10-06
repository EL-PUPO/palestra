import { X } from 'lucide-react'
import { mmss } from '../lib/formato'
import { fermaRecupero, modificaRecupero, useSecondiRimanenti, useTimer } from '../lib/timer'

/** Barra del recupero in basso; "dopo" dice cosa viene dopo (es. "Serie 3 · 65 kg × 8") */
export function BarraRecupero({ dopo }: { dopo?: string }) {
  const { fine, durata } = useTimer()
  const rimanenti = useSecondiRimanenti(fine)
  if (fine === null) return null
  const percentuale = durata ? Math.min(100, ((durata - rimanenti) / durata) * 100) : 0
  return (
    <div className="barra-recupero" role="timer" aria-live="off">
      <div className="contenuto">
        <div className="cresci" style={{ minWidth: 0 }}>
          <div className="piccolo" style={{ opacity: 0.7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {dopo ? `Recupero · ${dopo}` : 'Recupero'}
          </div>
          <div className="tempo">{mmss(rimanenti)}</div>
        </div>
        <button onClick={() => modificaRecupero(-15)}>−15</button>
        <button onClick={() => modificaRecupero(15)}>+15</button>
        <button onClick={fermaRecupero} aria-label="Salta recupero">
          <X size={18} />
        </button>
        <div className="progresso" style={{ width: `${percentuale}%` }} />
      </div>
    </div>
  )
}
