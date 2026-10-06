import { useLiveQuery } from 'dexie-react-hooks'
import { ChartLine, ChevronRight, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Testata, Vuoto } from '../componenti/ui'
import { db } from '../db'
import { NOMI_TIPO } from '../lib/descrizioni'
import { giorniFa, normalizzaNome, numero } from '../lib/formato'
import { recordForza, storicoEsercizio } from '../lib/statistiche'

export function Progressi() {
  const esercizi = useLiveQuery(() => db.esercizi.orderBy('nome').toArray(), [])
  const sessioni = useLiveQuery(() => db.sessioni.toArray(), [])
  const [cerca, setCerca] = useState('')
  const [gruppo, setGruppo] = useState<string | null>(null)

  const righe = useMemo(() => {
    if (!esercizi || !sessioni) return []
    return esercizi
      .map((e) => {
        const storico = storicoEsercizio(sessioni, e.id)
        return { e, storico, record: e.tipo === 'ripetizioni' ? recordForza(storico) : undefined }
      })
      .sort((a, b) => (b.storico[0]?.sessione.inizio ?? 0) - (a.storico[0]?.sessione.inizio ?? 0))
  }, [esercizi, sessioni])

  if (!esercizi || !sessioni) return null
  const gruppi = [...new Set(esercizi.map((e) => e.gruppo).filter(Boolean))] as string[]
  const q = normalizzaNome(cerca)
  const filtrate = righe.filter(({ e }) => (!q || normalizzaNome(e.nome).includes(q)) && (!gruppo || e.gruppo === gruppo))
  const fatti = filtrate.filter((r) => r.storico.length)
  const maiFatti = filtrate.filter((r) => !r.storico.length)

  return (
    <>
      <Testata grande titolo="Progressi" />
      <div className="pagina">
        {!esercizi.length ? (
          <Vuoto icona={<ChartLine size={40} />} titolo="Ancora niente da mostrare" testo="Dopo i primi allenamenti qui vedrai i grafici di ogni esercizio." />
        ) : (
          <>
            <div className="riga" style={{ position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: 12, color: 'var(--testo-3)' }} />
              <input className="input" style={{ paddingLeft: 38 }} placeholder="Cerca esercizio" value={cerca} onChange={(e) => setCerca(e.target.value)} />
            </div>
            {gruppi.length > 0 && (
              <div className="chips">
                <button className={`chip${gruppo === null ? ' attivo' : ''}`} onClick={() => setGruppo(null)}>
                  Tutti
                </button>
                {gruppi.map((g) => (
                  <button key={g} className={`chip${gruppo === g ? ' attivo' : ''}`} onClick={() => setGruppo(g)}>
                    {g}
                  </button>
                ))}
              </div>
            )}
            {fatti.length > 0 && (
              <div className="lista">
                {fatti.map(({ e, storico, record }) => (
                  <Link key={e.id} to={`/progressi/${e.id}`} className="voce">
                    <div className="corpo">
                      <div className="titolo">{e.nome}</div>
                      <div className="sotto">
                        {storico.length} {storico.length === 1 ? 'volta' : 'volte'} · ultima {giorniFa(storico[0].sessione.inizio)}
                      </div>
                    </div>
                    {record?.maxKg && <span className="badge accento">{numero(record.maxKg.kg)} kg</span>}
                    <ChevronRight size={18} className="freccia" />
                  </Link>
                ))}
              </div>
            )}
            {maiFatti.length > 0 && (
              <div className="sezione">
                <span className="etichetta-sezione">Non ancora allenati</span>
                <div className="lista">
                  {maiFatti.map(({ e }) => (
                    <Link key={e.id} to={`/progressi/${e.id}`} className="voce">
                      <div className="corpo">
                        <div className="titolo">{e.nome}</div>
                        <div className="sotto">{[NOMI_TIPO[e.tipo], e.gruppo].filter(Boolean).join(' · ')}</div>
                      </div>
                      <ChevronRight size={18} className="freccia" />
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
