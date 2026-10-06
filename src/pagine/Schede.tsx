import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight, ClipboardList, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Testata, Vuoto } from '../componenti/ui'
import { db, type Scheda } from '../db'
import { dataBreve } from '../lib/formato'

function VoceScheda({ s, sessioni }: { s: Scheda; sessioni: number }) {
  const esercizi = s.giorni.reduce((t, g) => t + g.esercizi.length, 0)
  return (
    <Link to={`/schede/${s.id}`} className="voce">
      <div className="corpo">
        <div className="titolo">{s.nome}</div>
        <div className="sotto">
          {s.giorni.length} {s.giorni.length === 1 ? 'giorno' : 'giorni'} · {esercizi} esercizi · {sessioni} allenamenti
        </div>
        <div className="sotto">
          Dal {dataBreve(s.creataIl)}
          {s.archiviataIl ? ` al ${dataBreve(s.archiviataIl)}` : ''}
        </div>
      </div>
      <ChevronRight size={18} className="freccia" />
    </Link>
  )
}

export function Schede() {
  const schede = useLiveQuery(() => db.schede.orderBy('creataIl').reverse().toArray(), [])
  const conteggi = useLiveQuery(async () => {
    const m = new Map<string, number>()
    for (const s of await db.sessioni.toArray()) if (s.schedaId && s.fine) m.set(s.schedaId, (m.get(s.schedaId) ?? 0) + 1)
    return m
  }, [])
  if (!schede || !conteggi) return null
  const attiva = schede.find((s) => s.attiva)
  const altre = schede.filter((s) => !s.attiva)

  return (
    <>
      <Testata
        grande
        titolo="Schede"
        azioni={
          <Link to="/schede/nuova" className="btn tenue piccolo">
            <Plus size={16} /> Nuova
          </Link>
        }
      />
      <div className="pagina">
        {!schede.length && (
          <div className="card">
            <Vuoto
              icona={<ClipboardList size={40} />}
              titolo="Nessuna scheda"
              testo="Incolla la scheda che ti ha dato l'istruttore: la sistemo io in giorni ed esercizi."
              azione={
                <Link to="/schede/nuova" className="btn primario">
                  Inserisci scheda
                </Link>
              }
            />
          </div>
        )}
        {attiva && (
          <div className="sezione">
            <span className="etichetta-sezione">Attiva</span>
            <div className="lista">
              <VoceScheda s={attiva} sessioni={conteggi.get(attiva.id) ?? 0} />
            </div>
          </div>
        )}
        {altre.length > 0 && (
          <div className="sezione">
            <span className="etichetta-sezione">Schede precedenti</span>
            <div className="lista">
              {altre.map((s) => (
                <VoceScheda key={s.id} s={s} sessioni={conteggi.get(s.id) ?? 0} />
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
