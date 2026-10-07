import { useLiveQuery } from 'dexie-react-hooks'
import { Check, Pencil, PartyPopper, Trash2, Trophy, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CampoNumero, CampoTesto, Testata } from '../componenti/ui'
import { db, type CardioRegistrato, type VoceSessione } from '../db'
import { conKg, conValore, IntestazioneSerie, RigaSerie } from '../componenti/Serie'
import { esitoCardio } from '../lib/allenamento'
import { descriviObiettivo } from '../lib/descrizioni'
import { chiaveGiorno, daGiornoEOra, dataLunga, durataLeggibile, maiuscolaIniziale, numero, ora, orario, recupero } from '../lib/formato'
import { contaSerie, recordBattuti, volumeSessione } from '../lib/statistiche'

function conCardio(v: VoceSessione, modifiche: Partial<CardioRegistrato>): VoceSessione {
  const cardio = { esito: null, ...v.cardio, ...modifiche }
  return { ...v, cardio: { ...cardio, esito: esitoCardio(v.obiettivo, cardio) } }
}

export function DettaglioSessione() {
  const { id } = useParams()
  const [parametri] = useSearchParams()
  const naviga = useNavigate()
  const sessione = useLiveQuery(() => db.sessioni.get(id!), [id])
  const esercizi = useLiveQuery(async () => new Map((await db.esercizi.toArray()).map((e) => [e.id, e])), [])
  const tutte = useLiveQuery(() => db.sessioni.toArray(), [])
  const [modifica, setModifica] = useState(false)

  if (sessione === undefined || !esercizi || !tutte) return null
  if (sessione === null) return <Testata titolo="Allenamento non trovato" indietro="/storico" />

  const riepilogo = parametri.get('riepilogo') === '1'
  const { fatte, complete } = contaSerie(sessione)
  const volume = volumeSessione(sessione)
  const nomi = new Map([...esercizi].map(([k, e]) => [k, e.nome]))
  const record = recordBattuti(sessione, tutte, nomi)
  const durata = (sessione.fine ?? Date.now()) - sessione.inizio

  /** Cambia giorno/ora mantenendo la durata */
  const spostaInizio = (inizio: number) => db.sessioni.update(sessione.id, { inizio, fine: inizio + ((sessione.fine ?? sessione.inizio) - sessione.inizio) })

  const salvaVoce = (uid: string, f: (v: VoceSessione) => VoceSessione) =>
    db.transaction('rw', db.sessioni, async () => {
      const s = await db.sessioni.get(sessione.id)
      if (s) await db.sessioni.update(s.id, { voci: s.voci.map((v) => (v.uid === uid ? f(v) : v)) })
    })

  const elimina = async () => {
    if (!confirm('Eliminare questo allenamento dallo storico?')) return
    await db.sessioni.delete(sessione.id)
    naviga('/storico', { replace: true })
  }

  return (
    <>
      <Testata
        titolo={riepilogo ? 'Fatto!' : sessione.nomeGiorno}
        indietro={riepilogo ? '/' : '/storico'}
        azioni={
          <button className={`btn piccolo${modifica ? ' primario' : ''}`} onClick={() => setModifica(!modifica)}>
            {modifica ? (
              'Fine'
            ) : (
              <>
                <Pencil size={16} /> Modifica
              </>
            )}
          </button>
        }
      />
      <div className="pagina">
        {riepilogo && (
          <div className="card evidenza colonna centro" style={{ alignItems: 'center' }}>
            <PartyPopper size={36} style={{ color: 'var(--accento)' }} />
            <h2>Allenamento completato</h2>
            <p className="muto">{sessione.nomeGiorno}</p>
          </div>
        )}

        {!riepilogo && !modifica && (
          <p className="muto" style={{ marginTop: -8 }}>
            {maiuscolaIniziale(dataLunga(sessione.inizio))} · {ora(sessione.inizio)}
          </p>
        )}

        {modifica && (
          <div className="card griglia-3">
            <label className="campo">
              <span>Giorno</span>
              <input type="date" value={chiaveGiorno(sessione.inizio)} max={chiaveGiorno()} onChange={(e) => e.target.value && spostaInizio(daGiornoEOra(e.target.value, orario(sessione.inizio)))} />
            </label>
            <label className="campo">
              <span>Ora</span>
              <input type="time" value={orario(sessione.inizio)} onChange={(e) => e.target.value && spostaInizio(daGiornoEOra(chiaveGiorno(sessione.inizio), e.target.value))} />
            </label>
            <label className="campo">
              <span>Durata (min)</span>
              <CampoNumero
                className="input"
                decimali={false}
                placeholder="—"
                valore={sessione.senzaDurata ? undefined : Math.round(durata / 60000)}
                cambia={(min) => db.sessioni.update(sessione.id, min ? { fine: sessione.inizio + min * 60000, senzaDurata: undefined } : { fine: sessione.inizio, senzaDurata: true })}
              />
            </label>
          </div>
        )}

        <div className="metriche">
          {!sessione.senzaDurata && (
            <div className="metrica">
              <div className="etichetta">Durata</div>
              <div className="valore">{durataLeggibile(durata)}</div>
            </div>
          )}
          <div className="metrica">
            <div className="etichetta">Serie complete</div>
            <div className="valore">
              {complete}
              <small> / {fatte}</small>
            </div>
          </div>
          {volume > 0 && (
            <div className="metrica">
              <div className="etichetta">Kg sollevati</div>
              <div className="valore">{numero(Math.round(volume))}</div>
            </div>
          )}
        </div>

        {record.length > 0 && (
          <div className="card colonna" style={{ gap: 6 }}>
            <div className="riga">
              <Trophy size={18} className="attenzione" />
              <h3>Nuovi record</h3>
            </div>
            {record.map((r) => (
              <p key={r} className="piccolo">
                {r}
              </p>
            ))}
          </div>
        )}

        {sessione.voci.map((v) => {
          const es = esercizi.get(v.esercizioId)
          return (
            <div key={v.uid} className="card colonna" style={{ gap: 8 }}>
              <div className="riga spazio">
                <Link to={`/progressi/${v.esercizioId}`}>
                  <h3>{es?.nome ?? 'Esercizio'}</h3>
                </Link>
                <span className="piccolo muto">{descriviObiettivo(v.obiettivo, v.tipo)}</span>
              </div>
              {v.tipo === 'cardio' && v.cardio ? (
                modifica ? (
                  <div className="griglia-2">
                    <label className="campo">
                      <span>Durata (min)</span>
                      <CampoNumero className="input" valore={v.cardio.durataMin} cambia={(durataMin) => salvaVoce(v.uid, (x) => conCardio(x, { durataMin }))} />
                    </label>
                    <label className="campo">
                      <span>Distanza (km)</span>
                      <CampoNumero className="input" valore={v.cardio.distanzaKm} cambia={(distanzaKm) => salvaVoce(v.uid, (x) => conCardio(x, { distanzaKm }))} />
                    </label>
                  </div>
                ) : (
                  <p>
                    {[v.cardio.durataMin && `${numero(v.cardio.durataMin, 1)} min`, v.cardio.distanzaKm && `${numero(v.cardio.distanzaKm)} km`, v.cardio.note].filter(Boolean).join(' · ') ||
                      '—'}{' '}
                    {v.cardio.esito === 'si' ? <Check size={16} className="successo" /> : v.cardio.esito === 'no' ? <X size={16} className="attenzione" /> : null}
                  </p>
                )
              ) : (
                <div className="serie-tabella" style={{ gap: 6 }}>
                  {modifica && v.serie.length > 0 && <IntestazioneSerie tipo={v.tipo} />}
                  {v.serie.map((s, i) =>
                    modifica ? (
                      <RigaSerie
                        key={i}
                        s={s}
                        i={i}
                        tipo={v.tipo}
                        cambiaKg={(kg) => salvaVoce(v.uid, (x) => conKg(x, i, kg))}
                        cambiaValore={(valore) => salvaVoce(v.uid, (x) => conValore(x, i, valore))}
                        azione={
                          <button className="btn-icona" aria-label={`Elimina la serie ${i + 1}`} onClick={() => salvaVoce(v.uid, (x) => ({ ...x, serie: x.serie.filter((_, j) => j !== i) }))}>
                            <Trash2 size={18} />
                          </button>
                        }
                      />
                    ) : (
                      <div key={i} className="riga spazio piccolo">
                        <span className="muto">Serie {i + 1}</span>
                        <span className="riga" style={{ gap: 6, fontWeight: 600 }}>
                          {v.tipo === 'ripetizioni' ? `${s.kg !== undefined ? `${numero(s.kg)} kg × ` : ''}${s.valore ?? '–'}` : recupero(s.valore)}
                          {s.massimale && <span className="badge accento">MAX</span>}
                          {!s.massimale && s.obiettivo !== undefined && s.valore !== undefined && s.valore !== s.obiettivo && (
                            <span className={s.valore > s.obiettivo ? 'successo' : 'attenzione'}>
                              ({s.valore > s.obiettivo ? '+' : '−'}
                              {Math.abs(s.valore - s.obiettivo)})
                            </span>
                          )}
                          {s.esito === 'si' ? <Check size={16} className="successo" /> : <X size={16} className="attenzione" />}
                        </span>
                      </div>
                    ),
                  )}
                </div>
              )}
              {v.note && <p className="piccolo muto">{v.note}</p>}
            </div>
          )
        })}

        <label className="campo">
          <span>Note sull'allenamento</span>
          <CampoTesto valore={sessione.note ?? ''} placeholder="energia, sonno, dolori…" cambia={(note) => db.sessioni.update(sessione.id, { note: note || undefined })} />
        </label>

        {riepilogo ? (
          <Link to="/" className="btn primario grande pieno">
            Chiudi
          </Link>
        ) : (
          modifica && (
            <button className="btn pericolo pieno" onClick={elimina}>
              <Trash2 size={18} /> Elimina allenamento
            </button>
          )
        )}
      </div>
    </>
  )
}
