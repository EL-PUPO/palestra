import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight, History } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendario } from '../componenti/Calendario'
import { Testata, Vuoto } from '../componenti/ui'
import { db, type Sessione } from '../db'
import { chiaveGiorno, dataBreve, durataLeggibile, numero } from '../lib/formato'
import { contaSerie, volumeSessione } from '../lib/statistiche'

function VoceSessioneLista({ s }: { s: Sessione }) {
  const { fatte, complete } = contaSerie(s)
  const volume = volumeSessione(s)
  return (
    <Link to={`/storico/${s.id}`} className="voce">
      <div className="corpo">
        <div className="titolo">{s.nomeGiorno}</div>
        <div className="sotto">
          {dataBreve(s.inizio)}
          {s.senzaDurata ? '' : ` · ${durataLeggibile((s.fine ?? s.inizio) - s.inizio)}`}
          {volume > 0 ? ` · ${numero(Math.round(volume))} kg sollevati` : ''}
        </div>
      </div>
      <span className={`badge ${complete === fatte ? 'successo' : 'attenzione'}`}>
        {complete}/{fatte}
      </span>
      <ChevronRight size={18} className="freccia" />
    </Link>
  )
}

export function Storico() {
  const sessioni = useLiveQuery(() => db.sessioni.orderBy('inizio').reverse().toArray(), [])
  const [giorno, setGiorno] = useState<string | null>(null)
  if (!sessioni) return null
  const concluse = sessioni.filter((s) => s.fine)
  const giorni = new Set(concluse.map((s) => chiaveGiorno(s.inizio)))
  const filtrate = giorno ? concluse.filter((s) => chiaveGiorno(s.inizio) === giorno) : concluse

  const perMese = new Map<string, Sessione[]>()
  for (const s of filtrate) {
    const m = new Date(s.inizio).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
    perMese.set(m, [...(perMese.get(m) ?? []), s])
  }

  return (
    <>
      <Testata grande titolo="Storico" />
      <div className="pagina">
        <Calendario giorniAllenati={giorni} selezionato={giorno} scegli={(g) => setGiorno(giorno === g || !giorni.has(g) ? null : g)} />
        {giorno && (
          <button className="btn piccolo" style={{ alignSelf: 'flex-start' }} onClick={() => setGiorno(null)}>
            Mostra tutti
          </button>
        )}
        {!concluse.length && <Vuoto icona={<History size={40} />} titolo="Ancora nessun allenamento" testo="Qui trovi tutti gli allenamenti conclusi." />}
        {[...perMese].map(([mese, lista]) => (
          <div key={mese} className="sezione">
            <span className="etichetta-sezione">{mese}</span>
            <div className="lista">
              {lista.map((s) => (
                <VoceSessioneLista key={s.id} s={s} />
              ))}
            </div>
          </div>
        ))}
        {concluse.length > 0 && <p className="piccolo muto centro">Il numero a destra indica le serie completate con tutte le ripetizioni.</p>}
      </div>
    </>
  )
}
