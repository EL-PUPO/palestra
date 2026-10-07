import { useLiveQuery } from 'dexie-react-hooks'
import { Check, Pencil, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { GraficoLinea, type PuntoGrafico } from '../componenti/GraficoLinea'
import { CampoNumero, CampoTesto, Foglio, Segmentato, Testata } from '../componenti/ui'
import { db } from '../db'
import { GRUPPI, NOMI_TIPO } from '../lib/descrizioni'
import { dataBreve, mmss, numero, recupero } from '../lib/formato'
import { useImpostazioni } from '../lib/impostazioni'
import { puntiCardio, puntiForza, puntiTempo, recordForza, serieFatte, storicoEsercizio } from '../lib/statistiche'

type Metrica = 'maxKg' | 'massimale' | 'volume' | 'durata' | 'distanza' | 'passo' | 'secondi'

const dataGrafico = (x: number) => new Date(x).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })

export function DettaglioEsercizio() {
  const { id } = useParams()
  const naviga = useNavigate()
  const imp = useImpostazioni()
  const esercizio = useLiveQuery(() => db.esercizi.get(id!), [id])
  const sessioni = useLiveQuery(() => db.sessioni.toArray(), [])
  const [metricaScelta, setMetrica] = useState<Metrica | null>(null)
  const [modifica, setModifica] = useState(false)

  if (esercizio === undefined || !sessioni) return null
  if (esercizio === null) return <Testata titolo="Esercizio non trovato" indietro="/progressi" />

  const storico = storicoEsercizio(sessioni, esercizio.id)
  const tipo = esercizio.tipo
  const metrica: Metrica = metricaScelta ?? (tipo === 'cardio' ? 'durata' : tipo === 'tempo' ? 'secondi' : 'maxKg')

  let punti: PuntoGrafico[] = []
  let formato: (v: number) => string = (v) => numero(v)
  if (tipo === 'ripetizioni') {
    const p = puntiForza(storico)
    if (metrica === 'volume') {
      punti = p.filter((x) => x.volume > 0).map((x) => ({ x: x.data, y: Math.round(x.volume) }))
      formato = (v) => `${numero(v)} kg`
    } else if (metrica === 'massimale') {
      punti = p.filter((x) => x.massimale > 0).map((x) => ({ x: x.data, y: Math.round(x.massimale * 10) / 10 }))
      formato = (v) => `${numero(v, 1)} kg`
    } else {
      punti = p.filter((x) => x.maxKg > 0).map((x) => ({ x: x.data, y: x.maxKg }))
      formato = (v) => `${numero(v)} kg`
    }
  } else if (tipo === 'cardio') {
    const p = puntiCardio(storico)
    if (metrica === 'distanza') {
      punti = p.filter((x) => x.distanzaKm).map((x) => ({ x: x.data, y: x.distanzaKm! }))
      formato = (v) => `${numero(v)} km`
    } else if (metrica === 'passo') {
      punti = p.filter((x) => x.passo).map((x) => ({ x: x.data, y: Math.round(x.passo! * 100) / 100 }))
      formato = (v) => `${mmss(v * 60)} min/km`
    } else {
      punti = p.filter((x) => x.durataMin).map((x) => ({ x: x.data, y: x.durataMin! }))
      formato = (v) => `${numero(v, 1)} min`
    }
  } else {
    punti = puntiTempo(storico).map((x) => ({ x: x.data, y: x.maxSecondi }))
    formato = (v) => recupero(v)
  }

  const opzioniMetrica: { valore: Metrica; etichetta: string }[] =
    tipo === 'ripetizioni'
      ? [
          { valore: 'maxKg', etichetta: 'Carico max' },
          { valore: 'massimale', etichetta: 'Massimale' },
          { valore: 'volume', etichetta: 'Volume' },
        ]
      : tipo === 'cardio'
        ? [
            { valore: 'durata', etichetta: 'Durata' },
            { valore: 'distanza', etichetta: 'Distanza' },
            { valore: 'passo', etichetta: 'Passo' },
          ]
        : []

  const record = tipo === 'ripetizioni' ? recordForza(storico) : undefined
  const spiegazione: Partial<Record<Metrica, string>> = {
    maxKg: 'Il carico più alto usato in ogni allenamento.',
    massimale: 'Il peso alzato per 1 colpo; se non hai fatto massimali è una stima da carico e ripetizioni.',
    volume: 'Somma di kg × ripetizioni di tutte le serie.',
    passo: 'Minuti per chilometro: più basso è, più sei veloce.',
  }

  const elimina = async () => {
    const usato = storico.length > 0
    if (!confirm(usato ? `Eliminare «${esercizio.nome}»? Resterà negli allenamenti passati ma senza nome.` : `Eliminare «${esercizio.nome}»?`)) return
    await db.esercizi.delete(esercizio.id)
    naviga('/progressi', { replace: true })
  }

  return (
    <>
      <Testata
        titolo={esercizio.nome}
        indietro
        azioni={
          <button className="btn-icona" aria-label="Modifica esercizio" onClick={() => setModifica(true)}>
            <Pencil size={20} />
          </button>
        }
      />
      <div className="pagina">
        <p className="muto" style={{ marginTop: -8 }}>
          {[NOMI_TIPO[tipo], esercizio.gruppo, `${storico.length} ${storico.length === 1 ? 'allenamento' : 'allenamenti'}`].filter(Boolean).join(' · ')}
        </p>

        {record?.maxKg && (
          <div className="metriche">
            <div className="metrica">
              <div className="etichetta">Carico max</div>
              <div className="valore">
                {numero(record.maxKg.kg)} <small>kg × {record.maxKg.rip}</small>
              </div>
            </div>
            {record.massimaleReale && (
              <div className="metrica">
                <div className="etichetta">Massimale · {dataBreve(record.massimaleReale.data)}</div>
                <div className="valore">
                  {numero(record.massimaleReale.kg)} <small>kg × 1</small>
                </div>
              </div>
            )}
            {record.massimale && !record.massimaleReale && (
              <div className="metrica">
                <div className="etichetta">Massimale stimato</div>
                <div className="valore">
                  {numero(record.massimale.valore, 1)} <small>kg</small>
                </div>
              </div>
            )}
          </div>
        )}

        {punti.length > 0 ? (
          <div className="card colonna">
            {opzioniMetrica.length > 0 && <Segmentato opzioni={opzioniMetrica} valore={metrica} cambia={setMetrica} />}
            <GraficoLinea punti={punti} formatoY={formato} formatoX={dataGrafico} />
            {spiegazione[metrica] && <p className="piccolo muto">{spiegazione[metrica]}</p>}
          </div>
        ) : (
          <div className="card muto centro">Il grafico comparirà dopo il primo allenamento con questo esercizio.</div>
        )}

        {storico.length > 0 && (
          <div className="sezione">
            <span className="etichetta-sezione">Storico</span>
            <div className="lista">
              {storico.map(({ sessione, voce }) => (
                <Link key={sessione.id} to={`/storico/${sessione.id}`} className="voce">
                  <div className="corpo">
                    <div className="titolo" style={{ fontWeight: 500 }}>
                      {dataBreve(sessione.inizio)}
                    </div>
                    <div className="sotto" style={{ whiteSpace: 'normal' }}>
                      {voce.tipo === 'cardio'
                        ? [voce.cardio?.durataMin && `${numero(voce.cardio.durataMin, 1)} min`, voce.cardio?.distanzaKm && `${numero(voce.cardio.distanzaKm)} km`]
                            .filter(Boolean)
                            .join(' · ')
                        : serieFatte(voce)
                            .map((s) => (voce.tipo === 'tempo' ? recupero(s.valore) : `${s.kg !== undefined ? `${numero(s.kg)}×` : ''}${s.valore ?? ''}`))
                            .join(' · ')}
                    </div>
                  </div>
                  {(voce.tipo === 'cardio' ? voce.cardio?.esito === 'si' : serieFatte(voce).every((s) => s.esito === 'si')) ? (
                    <Check size={18} className="successo" />
                  ) : (
                    <X size={18} className="attenzione" />
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <Foglio aperto={modifica} chiudi={() => setModifica(false)} titolo="Modifica esercizio">
        <div className="colonna">
          <label className="campo">
            <span>Nome</span>
            <CampoTesto valore={esercizio.nome} cambia={(nome) => nome.trim() && db.esercizi.update(esercizio.id, { nome })} />
          </label>
          <label className="campo">
            <span>Gruppo muscolare</span>
            <select value={esercizio.gruppo ?? ''} onChange={(e) => db.esercizi.update(esercizio.id, { gruppo: e.target.value || undefined })}>
              <option value="">—</option>
              {[...new Set([...GRUPPI, ...(esercizio.gruppo ? [esercizio.gruppo] : [])])].map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </label>
          {tipo === 'ripetizioni' && (
            <label className="campo">
              <span>Aumento di carico suggerito (kg)</span>
              <CampoNumero
                className="input"
                valore={esercizio.incrementoKg}
                placeholder={`${numero(imp.incrementoKg)} (predefinito)`}
                cambia={(incrementoKg) => db.esercizi.update(esercizio.id, { incrementoKg })}
              />
            </label>
          )}
          <label className="campo">
            <span>Note</span>
            <CampoTesto valore={esercizio.note ?? ''} placeholder="regolazioni macchina, presa…" cambia={(note) => db.esercizi.update(esercizio.id, { note: note || undefined })} />
          </label>
          <div className="griglia-2">
            <button className="btn pericolo" onClick={elimina}>
              <Trash2 size={18} /> Elimina
            </button>
            <button className="btn primario" onClick={() => setModifica(false)}>
              Fatto
            </button>
          </div>
        </div>
      </Foglio>
    </>
  )
}
