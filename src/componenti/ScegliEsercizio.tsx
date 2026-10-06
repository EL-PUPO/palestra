import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { db, type Esercizio, type TipoEsercizio } from '../db'
import type { SceltaEsercizio } from '../lib/allenamento'
import { CATALOGO, GRUPPI_CATALOGO, indovinaGruppo } from '../lib/catalogo'
import { NOMI_TIPO } from '../lib/descrizioni'
import { maiuscolaIniziale, normalizzaNome } from '../lib/formato'
import { Foglio, Segmentato } from './ui'

interface Riga {
  chiave: string
  nome: string
  gruppo?: string
  tipo: TipoEsercizio
  attrezzo?: string
  esercizio?: Esercizio
}

const TUTTI = '__tutti'
const MIEI = '__miei'

/** Tutte le parole cercate compaiono nel nome: "panca manubri" trova "Panca piana con manubri" */
function corrisponde(nome: string, parole: string[]) {
  const n = normalizzaNome(nome)
  return parole.every((p) => n.includes(p))
}

function VoceRiga({ r, scegli, mostraGruppo }: { r: Riga; scegli: (r: Riga) => void; mostraGruppo?: boolean }) {
  const dettagli = [r.attrezzo, r.tipo !== 'ripetizioni' ? NOMI_TIPO[r.tipo] : undefined, mostraGruppo ? r.gruppo : undefined].filter(Boolean)
  return (
    <button className="voce" onClick={() => scegli(r)}>
      <div className="corpo">
        <div className="titolo">{r.nome}</div>
        {dettagli.length > 0 && <div className="sotto">{dettagli.join(' · ')}</div>}
      </div>
      {r.esercizio && <span className="badge accento">tuo</span>}
    </button>
  )
}

/** Libreria di esercizi divisa per gruppo muscolare, con ricerca e creazione di esercizi nuovi */
export function ScegliEsercizio({
  aperto,
  chiudi,
  scegli,
  titolo = 'Aggiungi esercizio',
}: {
  aperto: boolean
  chiudi: () => void
  scegli: (s: SceltaEsercizio) => void
  titolo?: string
}) {
  const miei = useLiveQuery(() => db.esercizi.toArray(), [])
  const [cerca, setCerca] = useState('')
  const [filtro, setFiltro] = useState(TUTTI)
  const [tipoNuovo, setTipoNuovo] = useState<TipoEsercizio>('ripetizioni')
  const [gruppoNuovo, setGruppoNuovo] = useState('')

  useEffect(() => {
    if (aperto) {
      setCerca('')
      setFiltro(TUTTI)
    }
  }, [aperto])

  const righe = useMemo(() => {
    const mappa = new Map<string, Riga>()
    for (const c of CATALOGO) {
      const k = normalizzaNome(c.nome)
      mappa.set(k, { chiave: k, nome: c.nome, gruppo: c.gruppo, tipo: c.tipo, attrezzo: c.attrezzo })
    }
    for (const e of miei ?? []) {
      const k = normalizzaNome(e.nome)
      const c = mappa.get(k)
      mappa.set(k, { chiave: k, nome: e.nome, gruppo: e.gruppo ?? c?.gruppo, tipo: e.tipo, attrezzo: c?.attrezzo, esercizio: e })
    }
    return [...mappa.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'it'))
  }, [miei])

  const parole = normalizzaNome(cerca).split(' ').filter(Boolean)
  const visibili = righe.filter(
    (r) => (!parole.length || corrisponde(r.nome, parole)) && (filtro === TUTTI || (filtro === MIEI ? !!r.esercizio : r.gruppo === filtro)),
  )
  const esisteUguale = righe.some((r) => r.chiave === normalizzaNome(cerca))
  const gruppiMiei = [...new Set((miei ?? []).map((e) => e.gruppo).filter((g): g is string => !!g && !GRUPPI_CATALOGO.includes(g)))]
  const gruppi = [...GRUPPI_CATALOGO, ...gruppiMiei]

  useEffect(() => {
    if (cerca.trim()) {
      const g = indovinaGruppo(cerca)
      setGruppoNuovo(filtro !== TUTTI && filtro !== MIEI ? filtro : (g ?? ''))
      setTipoNuovo(g === 'Cardio' ? 'cardio' : 'ripetizioni')
    }
  }, [cerca, filtro])

  const conferma = (r: Riga) => scegli({ esercizio: r.esercizio, nome: r.nome, tipo: r.tipo, gruppo: r.gruppo })

  const crea = () => scegli({ nome: maiuscolaIniziale(cerca), tipo: tipoNuovo, gruppo: gruppoNuovo || undefined })

  // con "Tutti" e senza ricerca: elenco diviso per gruppo
  const sezioni = filtro === TUTTI && !parole.length
  const senzaGruppo = visibili.filter((r) => !r.gruppo || !gruppi.includes(r.gruppo))

  return (
    <Foglio aperto={aperto} chiudi={chiudi} titolo={titolo} alto>
      <div className="ricerca-fissa colonna" style={{ gap: 10 }}>
        <div className="riga" style={{ position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: 12, color: 'var(--testo-3)' }} />
          <input
            className="input"
            style={{ paddingLeft: 38, paddingRight: 38 }}
            placeholder={`Cerca tra ${righe.length} esercizi`}
            value={cerca}
            onChange={(e) => setCerca(e.target.value)}
            enterKeyHint="search"
          />
          {cerca && (
            <button className="btn-icona" style={{ position: 'absolute', right: 2 }} aria-label="Cancella ricerca" onClick={() => setCerca('')}>
              <X size={18} />
            </button>
          )}
        </div>
        <div className="chips">
          <button className={`chip${filtro === TUTTI ? ' attivo' : ''}`} onClick={() => setFiltro(TUTTI)}>
            Tutti
          </button>
          {(miei?.length ?? 0) > 0 && (
            <button className={`chip${filtro === MIEI ? ' attivo' : ''}`} onClick={() => setFiltro(MIEI)}>
              I miei
            </button>
          )}
          {gruppi.map((g) => (
            <button key={g} className={`chip${filtro === g ? ' attivo' : ''}`} onClick={() => setFiltro(g)}>
              {g}
            </button>
          ))}
        </div>
      </div>

      <div className="colonna" style={{ marginTop: 10 }}>
        {cerca.trim() && !esisteUguale && (
          <div className="card colonna">
            <div className="piccolo muto">Non c'è? Crealo:</div>
            <Segmentato
              opzioni={(['ripetizioni', 'tempo', 'cardio'] as TipoEsercizio[]).map((t) => ({ valore: t, etichetta: NOMI_TIPO[t] }))}
              valore={tipoNuovo}
              cambia={setTipoNuovo}
            />
            <label className="campo">
              <span>Gruppo muscolare</span>
              <select value={gruppoNuovo} onChange={(e) => setGruppoNuovo(e.target.value)}>
                <option value="">—</option>
                {gruppi.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </label>
            <button className="btn primario" onClick={crea}>
              <Plus size={18} /> Crea «{maiuscolaIniziale(cerca)}»
            </button>
          </div>
        )}

        {sezioni ? (
          <>
            {gruppi.map((g) => {
              const lista = visibili.filter((r) => r.gruppo === g)
              if (!lista.length) return null
              return (
                <div key={g} className="sezione">
                  <span className="etichetta-sezione">
                    {g} · {lista.length}
                  </span>
                  <div className="lista">
                    {lista.map((r) => (
                      <VoceRiga key={r.chiave} r={r} scegli={conferma} />
                    ))}
                  </div>
                </div>
              )
            })}
            {senzaGruppo.length > 0 && (
              <div className="sezione">
                <span className="etichetta-sezione">Senza gruppo</span>
                <div className="lista">
                  {senzaGruppo.map((r) => (
                    <VoceRiga key={r.chiave} r={r} scegli={conferma} />
                  ))}
                </div>
              </div>
            )}
          </>
        ) : visibili.length ? (
          <div className="lista">
            {visibili.map((r) => (
              <VoceRiga key={r.chiave} r={r} scegli={conferma} mostraGruppo={filtro === TUTTI || filtro === MIEI} />
            ))}
          </div>
        ) : (
          !cerca.trim() && <p className="muto centro">Nessun esercizio in questo gruppo</p>
        )}
      </div>
    </Foglio>
  )
}
