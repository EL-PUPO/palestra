import { useState } from 'react'
import type { Obiettivo, TipoEsercizio } from '../db'
import { leggiTestoRipetizioni, NOMI_TIPO, testoRipetizioni } from '../lib/descrizioni'
import { CampoNumero, CampoTesto, Passi, Segmentato } from './ui'

interface Props {
  tipo: TipoEsercizio
  obiettivo: Obiettivo
  cambia: (o: Obiettivo, tipo: TipoEsercizio) => void
  /** se falso il tipo non si può cambiare (esercizio già usato) */
  tipoModificabile?: boolean
}

/** Modifica serie, ripetizioni, recupero, carico o durata di un esercizio della scheda */
export function EditorObiettivo({ tipo, obiettivo: o, cambia, tipoModificabile = true }: Props) {
  const [testoRip, setTestoRip] = useState(testoRipetizioni(o))
  const aggiorna = (modifiche: Partial<Obiettivo>, nuovoTipo = tipo) => cambia({ ...o, ...modifiche }, nuovoTipo)

  return (
    <div className="colonna">
      {tipoModificabile && (
        <Segmentato
          opzioni={(['ripetizioni', 'tempo', 'cardio'] as TipoEsercizio[]).map((t) => ({ valore: t, etichetta: NOMI_TIPO[t] }))}
          valore={tipo}
          cambia={(t) => aggiorna({ serie: t === 'cardio' ? 1 : o.serie > 1 ? o.serie : 3 }, t)}
        />
      )}

      {tipo === 'ripetizioni' && (
        <>
          <div className="griglia-2">
            <label className="campo">
              <span>Serie</span>
              <Passi
                valore={o.serie}
                min={1}
                max={20}
                etichetta="serie"
                cambia={(serie) => aggiorna({ serie, ...(o.repPerSerie ? leggiTestoRipetizioni(testoRip, serie) : {}) })}
              />
            </label>
            <label className="campo">
              <span>Ripetizioni</span>
              <input
                inputMode="text"
                placeholder="8 · 8-10 · 10/8/6"
                value={testoRip}
                onChange={(e) => {
                  setTestoRip(e.target.value)
                  aggiorna(leggiTestoRipetizioni(e.target.value, o.serie))
                }}
              />
            </label>
          </div>
          <p className="piccolo muto">Scrivi 8-10 per un intervallo o 10/8/6 per una piramide.</p>
          <label className="campo">
            <span>Carico di partenza (kg, facoltativo)</span>
            <CampoNumero className="input" valore={o.caricoKg} cambia={(caricoKg) => aggiorna({ caricoKg })} placeholder="es. 40" />
          </label>
        </>
      )}

      {tipo === 'tempo' && (
        <div className="griglia-2">
          <label className="campo">
            <span>Serie</span>
            <Passi valore={o.serie} min={1} max={20} etichetta="serie" cambia={(serie) => aggiorna({ serie })} />
          </label>
          <label className="campo">
            <span>Secondi per serie</span>
            <Passi valore={o.secondi} min={5} max={600} passo={5} etichetta="secondi" cambia={(secondi) => aggiorna({ secondi })} />
          </label>
        </div>
      )}

      {tipo === 'cardio' && (
        <div className="griglia-2">
          <label className="campo">
            <span>Durata (min)</span>
            <CampoNumero className="input" valore={o.durataMin} cambia={(durataMin) => aggiorna({ durataMin })} placeholder="es. 20" />
          </label>
          <label className="campo">
            <span>Distanza (km)</span>
            <CampoNumero className="input" valore={o.distanzaKm} cambia={(distanzaKm) => aggiorna({ distanzaKm })} placeholder="es. 5" />
          </label>
        </div>
      )}

      {tipo !== 'cardio' && (
        <label className="campo">
          <span>Recupero (secondi)</span>
          <Passi valore={o.recuperoSec} min={0} max={600} passo={15} etichetta="recupero" cambia={(recuperoSec) => aggiorna({ recuperoSec })} />
        </label>
      )}

      <label className="campo">
        <span>Note</span>
        <CampoTesto valore={o.note ?? ''} placeholder="es. presa stretta, inclinazione 10%" cambia={(note) => aggiorna({ note: note || undefined })} />
      </label>
    </div>
  )
}
