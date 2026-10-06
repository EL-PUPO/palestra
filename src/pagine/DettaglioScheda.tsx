import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowDown, ArrowUp, Check, ClipboardPen, Pencil, Play, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { EditorObiettivo } from '../componenti/EditorObiettivo'
import { ScegliEsercizio } from '../componenti/ScegliEsercizio'
import { CampoTesto, Foglio, mostraMessaggio, Testata } from '../componenti/ui'
import { db, nuovoId, type EsercizioScheda, type GiornoScheda, type Modalita, type Scheda } from '../db'
import { assicuraEsercizio, attivaScheda, iniziaSessione, obiettivoDi, obiettivoIniziale, percorsoSessione, pulisciEserciziInutilizzati, sessioneInCorso } from '../lib/allenamento'
import { descriviObiettivo } from '../lib/descrizioni'
import { dataBreve } from '../lib/formato'
import { useImpostazioni } from '../lib/impostazioni'

export function DettaglioScheda() {
  const { id } = useParams()
  const naviga = useNavigate()
  const imp = useImpostazioni()
  const scheda = useLiveQuery(() => db.schede.get(id!), [id])
  const esercizi = useLiveQuery(async () => new Map((await db.esercizi.toArray()).map((e) => [e.id, e])), [])
  const [modifica, setModifica] = useState(false)
  const [aggiungiA, setAggiungiA] = useState<string | null>(null)
  const [inModifica, setInModifica] = useState<{ giorno: string; uid: string } | null>(null)
  const [testoVisibile, setTestoVisibile] = useState(false)

  if (scheda === undefined || !esercizi) return null
  if (scheda === null) return <Testata titolo="Scheda non trovata" indietro />

  const salvaGiorni = (giorni: GiornoScheda[]) => db.schede.update(scheda.id, { giorni })
  const modificaGiorno = (uid: string, f: (g: GiornoScheda) => GiornoScheda) => salvaGiorni(scheda.giorni.map((g) => (g.uid === uid ? f(g) : g)))
  const sposta = (g: GiornoScheda, i: number, d: number) => {
    const lista = [...g.esercizi]
    const j = i + d
    if (j < 0 || j >= lista.length) return
    ;[lista[i], lista[j]] = [lista[j], lista[i]]
    void modificaGiorno(g.uid, (x) => ({ ...x, esercizi: lista }))
  }

  const inizia = async (s: Scheda, g: GiornoScheda, modalita: Modalita) => {
    const inCorso = await sessioneInCorso()
    if (inCorso) {
      if (confirm(`C'è già un allenamento aperto (${inCorso.nomeGiorno}). Vuoi riprenderlo?`)) naviga(percorsoSessione(inCorso))
      return
    }
    await iniziaSessione(s, g, modalita)
    naviga(modalita === 'registro' ? '/registro' : '/allenamento')
  }

  const elimina = async () => {
    if (!confirm(`Eliminare «${scheda.nome}»? Gli allenamenti già fatti restano nello storico.`)) return
    await db.schede.delete(scheda.id)
    await pulisciEserciziInutilizzati()
    naviga('/schede', { replace: true })
  }

  const corrente = inModifica && scheda.giorni.find((g) => g.uid === inModifica.giorno)?.esercizi.find((e) => e.uid === inModifica.uid)
  const esCorrente = corrente ? esercizi.get(corrente.esercizioId) : undefined

  return (
    <>
      <Testata
        titolo={modifica ? 'Modifica scheda' : scheda.nome}
        indietro="/schede"
        azioni={
          <button className={`btn piccolo${modifica ? ' primario' : ''}`} onClick={() => setModifica(!modifica)}>
            {modifica ? (
              <>
                <Check size={16} /> Fine
              </>
            ) : (
              <>
                <Pencil size={16} /> Modifica
              </>
            )}
          </button>
        }
      />
      <div className="pagina">
        {modifica ? (
          <label className="campo">
            <span>Nome della scheda</span>
            <CampoTesto valore={scheda.nome} cambia={(nome) => db.schede.update(scheda.id, { nome })} />
          </label>
        ) : (
          <div className="riga spazio">
            <p className="muto piccolo">
              Creata il {dataBreve(scheda.creataIl)}
              {scheda.archiviataIl ? ` · archiviata il ${dataBreve(scheda.archiviataIl)}` : ''}
            </p>
            {scheda.attiva ? (
              <span className="badge successo">Attiva</span>
            ) : (
              <button
                className="btn tenue piccolo"
                onClick={async () => {
                  await attivaScheda(scheda.id)
                  mostraMessaggio('Ora è la scheda attiva')
                }}
              >
                Usa questa scheda
              </button>
            )}
          </div>
        )}

        {scheda.giorni.map((g) => (
          <div key={g.uid} className="anteprima-giorno">
            <header>
              {modifica ? (
                <>
                  <CampoTesto valore={g.nome} cambia={(nome) => modificaGiorno(g.uid, (x) => ({ ...x, nome }))} aria-label="Nome del giorno" />
                  <button
                    className="btn-icona"
                    aria-label="Elimina giorno"
                    onClick={() => confirm(`Eliminare «${g.nome}»?`) && salvaGiorni(scheda.giorni.filter((x) => x.uid !== g.uid))}
                  >
                    <Trash2 size={18} />
                  </button>
                </>
              ) : (
                <>
                  <h3 className="cresci">{g.nome}</h3>
                  <button className="btn piccolo" aria-label={`Registra ${g.nome}`} onClick={() => inizia(scheda, g, 'registro')}>
                    <ClipboardPen size={14} />
                  </button>
                  <button className="btn primario piccolo" onClick={() => inizia(scheda, g, 'allenamento')}>
                    <Play size={14} /> Allenati
                  </button>
                </>
              )}
            </header>
            {g.esercizi.map((e, i) => {
              const es = esercizi.get(e.esercizioId)
              return (
                <div key={e.uid} className="esercizio-anteprima">
                  <button
                    className="corpo"
                    style={{ flex: 1, minWidth: 0, background: 'none', border: 0, padding: 0, textAlign: 'left' }}
                    onClick={() => (modifica ? setInModifica({ giorno: g.uid, uid: e.uid }) : es && naviga(`/progressi/${es.id}`))}
                  >
                    <div style={{ fontWeight: 600 }}>{es?.nome ?? 'Esercizio eliminato'}</div>
                    <div className="piccolo muto">{descriviObiettivo(e, es?.tipo ?? 'ripetizioni')}</div>
                    {e.note && <div className="piccolo muto">{e.note}</div>}
                  </button>
                  {modifica && (
                    <div className="riga" style={{ gap: 0 }}>
                      <button className="btn-icona" aria-label="Sposta su" onClick={() => sposta(g, i, -1)}>
                        <ArrowUp size={18} />
                      </button>
                      <button className="btn-icona" aria-label="Sposta giù" onClick={() => sposta(g, i, 1)}>
                        <ArrowDown size={18} />
                      </button>
                      <button
                        className="btn-icona"
                        aria-label="Togli dalla scheda"
                        onClick={() => modificaGiorno(g.uid, (x) => ({ ...x, esercizi: x.esercizi.filter((y) => y.uid !== e.uid) }))}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
            {modifica && (
              <div style={{ padding: 8 }}>
                <button className="btn piccolo pieno" onClick={() => setAggiungiA(g.uid)}>
                  <Plus size={16} /> Aggiungi esercizio
                </button>
              </div>
            )}
          </div>
        ))}

        {modifica && (
          <>
            <button
              className="btn pieno"
              onClick={() => salvaGiorni([...scheda.giorni, { uid: nuovoId(), nome: `Giorno ${scheda.giorni.length + 1}`, esercizi: [] }])}
            >
              <Plus size={18} /> Aggiungi giorno
            </button>
            <button className="btn pericolo pieno" onClick={elimina}>
              <Trash2 size={18} /> Elimina scheda
            </button>
          </>
        )}

        {!modifica && scheda.testoOriginale && (
          <div className="card">
            <button className="riga spazio pieno" style={{ background: 'none', border: 0, padding: 0, width: '100%' }} onClick={() => setTestoVisibile(!testoVisibile)}>
              <h3>Testo originale</h3>
              <span className="piccolo muto">{testoVisibile ? 'Nascondi' : 'Mostra'}</span>
            </button>
            {testoVisibile && (
              <>
                <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, margin: '10px 0', color: 'var(--testo-2)' }}>{scheda.testoOriginale}</pre>
                <button
                  className="btn piccolo"
                  onClick={() => naviga('/schede/nuova', { state: { testo: scheda.testoOriginale, sostituisci: scheda.id } })}
                >
                  <RotateCcw size={16} /> Rileggi questo testo
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <ScegliEsercizio
        aperto={aggiungiA !== null}
        chiudi={() => setAggiungiA(null)}
        scegli={async (scelta) => {
          const giorno = aggiungiA!
          setAggiungiA(null)
          const es = await assicuraEsercizio(scelta)
          const nuovo: EsercizioScheda = { uid: nuovoId(), esercizioId: es.id, ...obiettivoIniziale(es.tipo, imp.recuperoPredefinito) }
          await db.transaction('rw', db.schede, async () => {
            const fresca = await db.schede.get(scheda.id)
            if (fresca) await db.schede.update(scheda.id, { giorni: fresca.giorni.map((g) => (g.uid === giorno ? { ...g, esercizi: [...g.esercizi, nuovo] } : g)) })
          })
          setInModifica({ giorno, uid: nuovo.uid })
        }}
      />

      <Foglio aperto={!!corrente} chiudi={() => setInModifica(null)} titolo={esCorrente?.nome ?? 'Esercizio'}>
        {corrente && inModifica && (
          <div className="colonna">
            <EditorObiettivo
              key={corrente.uid}
              tipo={esCorrente?.tipo ?? 'ripetizioni'}
              tipoModificabile={false}
              obiettivo={obiettivoDi(corrente)}
              cambia={(o) =>
                modificaGiorno(inModifica.giorno, (g) => ({ ...g, esercizi: g.esercizi.map((x) => (x.uid === corrente.uid ? { ...x, ...o } : x)) }))
              }
            />
            <button className="btn primario" onClick={() => setInModifica(null)}>
              Fatto
            </button>
          </div>
        )}
      </Foglio>
    </>
  )
}
